
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/law.dart';
import '../models/opinion.dart';
import '../services/debate_service.dart';

import '../theme/app_colors.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'package:url_launcher/url_launcher.dart';
import 'law_detail_screen.dart';
import '../services/user_session.dart';
import '../services/gamification_service.dart';
import '../models/citizen_progress.dart';

class DebateDetailScreen extends StatefulWidget {
  final Law law;

  const DebateDetailScreen({super.key, required this.law});

  @override
  State<DebateDetailScreen> createState() => _DebateDetailScreenState();
}

class _DebateDetailScreenState extends State<DebateDetailScreen> {
  List<Opinion> _opinions = [];
  bool _isLoading = true;
  String _sortBy = 'recent'; // 'recent' or 'popular'
  final TextEditingController _opinionController = TextEditingController();
  bool _isPosting = false;
  bool _isSummaryExpanded = false;
  
  CitizenProgress? _gamificationProgress;
  final GamificationService _gamificationService = GamificationService();
  bool _canPost = false; // Requires 1000 XP

  @override
  void initState() {
    super.initState();
    _fetchOpinions();
    _fetchGamificationProgress();
  }

  Future<void> _fetchGamificationProgress() async {
    final progress = await _gamificationService.getProgress();
    if (mounted) {
      setState(() {
        _gamificationProgress = progress;
        _canPost = (progress?.currentXP ?? 0) >= 300;
      });
    }
  }

  Future<void> _fetchOpinions() async {
    setState(() => _isLoading = true);
    try {
      final opinions = await DebateService.getOpinions(widget.law.id, sort: _sortBy);
      if (mounted) {
        setState(() {
          _opinions = opinions;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur chargement débats: $e')),
        );
      }
    }
  }

  Future<void> _postOpinion() async {
    final content = _opinionController.text.trim();
    if (content.isEmpty) return;

    if (content.length > 160) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Votre avis dépasse 160 caractères.')),
      );
      return;
    }

    setState(() => _isPosting = true);
    try {
      final newOpinion = await DebateService.postOpinion(widget.law.id, content);
      _opinionController.clear();
      if (mounted) {
        setState(() {
          _opinions.insert(0, newOpinion); // Add to top
          _isPosting = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Avis publié avec succès !')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isPosting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
        );
      }
    }
  }

  Future<void> _toggleMoke(Opinion opinion) async {
    try {
      // Optimistic Update
      final index = _opinions.indexWhere((o) => o.id == opinion.id);
      if (index == -1) return;

      final oldOpinion = _opinions[index];
      final newMokes = oldOpinion.hasMoked ? oldOpinion.mokes - 1 : oldOpinion.mokes + 1;
      final newHasMoked = !oldOpinion.hasMoked;

      setState(() {
        _opinions[index] = oldOpinion.copyWith(mokes: newMokes, hasMoked: newHasMoked);
      });

      // Appel API
      await DebateService.toggleMoke(opinion.id);
      
    } catch (e) {
      // Revert on error (re-fetch to be safe)
       _fetchOpinions();
    }
  }

  Future<void> _editOpinion(Opinion opinion) async {
    final editController = TextEditingController(text: opinion.content);
    final newContent = await showDialog<String>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Modifier votre avis'),
          content: TextField(
            controller: editController,
            maxLength: 160,
            maxLines: 4,
            decoration: InputDecoration(
              hintText: 'Votre avis en 160 caractères...',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(null),
              child: const Text('ANNULER'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(editController.text.trim()),
              child: const Text('ENREGISTRER', style: TextStyle(color: AppColors.primaryBlue, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
    editController.dispose();

    if (newContent == null || newContent.isEmpty || newContent == opinion.content) return;

    try {
      final updated = await DebateService.updateOpinion(opinion.id, newContent);
      final index = _opinions.indexWhere((o) => o.id == opinion.id);
      if (index != -1 && mounted) {
        setState(() {
          _opinions[index] = updated;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Avis modifié avec succès !')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: ${e.toString().replaceAll("Exception: ", "")}')),
        );
      }
    }
  }

  Future<void> _reportOpinion(Opinion opinion) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Signaler cet avis ?'),
        content: const Text('Voulez-vous vraiment signaler cet avis comme inapproprié ?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('ANNULER'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('SIGNALER', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await DebateService.reportOpinion(opinion.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Merci pour votre signalement. Notre équipe va l\'examiner.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text('Espace Débat', style: TextStyle(color: Colors.black)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
        actions: [
          IconButton(
            icon: const Icon(Icons.article_outlined, color: AppColors.primaryBlue),
            tooltip: 'Voir le texte de loi',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => LawDetailScreen(law: widget.law),
                ),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              children: [
                // Résumé Loi (Header)
                Container(
                  padding: const EdgeInsets.all(16),
                  color: Colors.white,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.law.formattedTitle,
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (widget.law.summary != null)
                        Container(
                          margin: const EdgeInsets.only(top: 16),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.paleBlue,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.lightBlue),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.lightbulb_outline, color: AppColors.primaryBlue, size: 24),
                                  const SizedBox(width: 8),
                                  const Text(
                                    'Résumé Démok',
                                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.darkBlue),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              ...widget.law.summary!.sections.entries.map((entry) {
                                final isFirst = entry.key == widget.law.summary!.sections.keys.first;
                                
                                // Même logique de visibilité que dans LawDetailScreen
                                if (!_isSummaryExpanded && !isFirst) {
                                  return const SizedBox.shrink();
                                }

                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      if (entry.key != 'default' && entry.key.toLowerCase() != 'résumé')
                                        Padding(
                                          padding: const EdgeInsets.only(bottom: 6.0),
                                          child: Text(
                                            entry.key.toUpperCase(),
                                            style: TextStyle(
                                              color: entry.key.toLowerCase().contains('pour') 
                                                ? Colors.green[700] 
                                                : (entry.key.toLowerCase().contains('contre') ? Colors.red[700] : AppColors.primaryBlue),
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                              letterSpacing: 1.0,
                                            ),
                                          ),
                                        ),
                                      Text(
                                        entry.value,
                                        maxLines: _isSummaryExpanded ? null : (isFirst ? 6 : null),
                                        overflow: _isSummaryExpanded ? null : (isFirst ? TextOverflow.ellipsis : null),
                                        style: const TextStyle(
                                          color: AppColors.textPrimary,
                                          fontSize: 15,
                                          height: 1.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }).toList(),
                              
                              // Bouton Voir plus / Voir moins
                              if (widget.law.summary!.sections.length > 1 || (widget.law.summary!.sections.values.first.length > 150))
                                TextButton(
                                  onPressed: () {
                                    setState(() {
                                      _isSummaryExpanded = !_isSummaryExpanded;
                                    });
                                  },
                                  style: TextButton.styleFrom(
                                    padding: EdgeInsets.zero,
                                    minimumSize: const Size(50, 30),
                                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                    alignment: Alignment.centerLeft,
                                  ),
                                  child: Text(
                                    _isSummaryExpanded ? 'Voir moins' : 'Lire la suite',
                                    style: const TextStyle(
                                      color: AppColors.primaryBlue,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),

                              if (widget.law.officialUrl != null || widget.law.latestTextUrl != null) ...[
                                const SizedBox(height: 8),
                                Center(
                                  child: InkWell(
                                    onTap: () async {
                                      final urlToLaunch = widget.law.latestTextUrl ?? widget.law.officialUrl!;
                                      final url = Uri.parse(urlToLaunch);
                                      try {
                                        await launchUrl(url, mode: LaunchMode.platformDefault);
                                      } catch (e) {
                                        debugPrint('Could not launch $urlToLaunch: $e');
                                        if (context.mounted) {
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            SnackBar(content: Text('Impossible d\'ouvrir le lien : $urlToLaunch')),
                                          );
                                        }
                                      }
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                                      child: const Text(
                                        'Lire le texte complet',
                                        style: TextStyle(
                                          color: AppColors.primaryBlue,
                                          decoration: TextDecoration.underline,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                
                // Banner Citoyen Actif (Top)
                if (!_canPost && _gamificationProgress != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    color: Colors.orange[50],
                    child: Row(
                      children: [
                         const Icon(Icons.lock, color: Colors.orange, size: 20),
                         const SizedBox(width: 12),
                         Expanded(
                           child: RichText(
                             text: const TextSpan(
                               style: TextStyle(color: Colors.orange, fontSize: 13, height: 1.4),
                               children: [
                                 TextSpan(text: 'Vous devez atteindre le niveau '),
                                 TextSpan(text: '"Citoyen Éveillé" (300 XP)', style: TextStyle(fontWeight: FontWeight.bold)),
                                 TextSpan(text: ' pour participer aux débats.'),
                               ],
                             ),
                           ),
                         ),
                      ],
                    ),
                  ),
                  
                const Divider(height: 1),
                
                // Filtres
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      Text('${_opinions.length} avis', style: const TextStyle(fontWeight: FontWeight.bold)),
                      const Spacer(),
                      DropdownButton<String>(
                        value: _sortBy,
                        underline: const SizedBox(),
                        style: const TextStyle(color: AppColors.primaryBlue, fontWeight: FontWeight.w600),
                        icon: const Icon(Icons.sort, color: AppColors.primaryBlue),
                        items: const [
                          DropdownMenuItem(value: 'recent', child: Text('Plus récents')),
                          DropdownMenuItem(value: 'popular', child: Text('Plus populaires')),
                        ],
                        onChanged: (val) {
                          if (val != null) {
                            setState(() => _sortBy = val);
                            _fetchOpinions();
                          }
                        },
                      ),
                    ],
                  ),
                ),

                // Liste des avis
                if (_isLoading)
                  const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()))
                else if (_opinions.isEmpty)
                  Padding(
                    padding: const EdgeInsets.all(64),
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.forum_outlined, size: 64, color: Colors.grey[300]),
                          const SizedBox(height: 16),
                          const Text('Soyez le premier à donner votre avis !', style: TextStyle(color: Colors.grey)),
                        ],
                      ),
                    ),
                  )
                else
                  ..._opinions.map((o) => Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    child: _buildOpinionCard(o),
                  )).toList(),
                
                const SizedBox(height: 32), // Padding bottom for list
              ],
            ),
          ),

          // Zone de saisie (Bottom)
          _buildInputArea(),
        ],
      ),
    );
  }

  Widget _buildOpinionCard(Opinion opinion) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 5,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Badge Niveau
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.primaryBlue.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Text(
                  '${opinion.author.level}',
                  style: const TextStyle(color: AppColors.primaryBlue, fontWeight: FontWeight.bold, fontSize: 12),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                opinion.author.pseudo,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const Spacer(),
              Text(
                timeago.format(opinion.createdAt, locale: 'fr'),
                style: TextStyle(color: Colors.grey[500], fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            opinion.content,
            style: const TextStyle(fontSize: 15, height: 1.4),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              // Bouton Signaler (seulement si ce n'est pas son propre avis)
              if (!opinion.isOwn)
                IconButton(
                  icon: const Icon(Icons.flag_outlined, size: 20, color: Colors.grey),
                  onPressed: () => _reportOpinion(opinion),
                  tooltip: 'Signaler',
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                )
              else
                // Bouton Modifier (seulement pour ses propres avis)
                IconButton(
                  icon: const Icon(Icons.edit_outlined, size: 20, color: AppColors.primaryBlue),
                  onPressed: () => _editOpinion(opinion),
                  tooltip: 'Modifier',
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              const Spacer(),
              InkWell(
                onTap: () => _toggleMoke(opinion),
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: opinion.hasMoked ? AppColors.primaryBlue.withValues(alpha: 0.1) : Colors.grey[100],
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        opinion.hasMoked ? Icons.favorite : Icons.favorite_border,
                        size: 18,
                        color: opinion.hasMoked ? AppColors.primaryBlue : Colors.grey[600],
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${opinion.mokes} Mokes',
                        style: TextStyle(
                          color: opinion.hasMoked ? AppColors.primaryBlue : Colors.grey[800],
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, -3)),
        ],
      ),
      child: SafeArea(
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _opinionController,
                    maxLength: 160,
                    enabled: _canPost,
                    decoration: InputDecoration(
                      hintText: 'Votre avis en 160 caractères...',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(25), borderSide: BorderSide.none),
                      filled: true,
                      fillColor: Colors.grey[100],
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      counterText: '', // Hide default counter
                    ),
                    maxLines: null,
                  ),
                ),
                const SizedBox(width: 8),
                FloatingActionButton(
                  onPressed: _isPosting || !_canPost ? null : _postOpinion,
                  backgroundColor: _canPost ? AppColors.primaryBlue : Colors.grey,
                  elevation: 0,
                  mini: true,
                  child: _isPosting 
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) 
                    : const Icon(Icons.send, color: Colors.white, size: 20),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
