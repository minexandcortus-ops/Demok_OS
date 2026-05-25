import 'package:flutter/material.dart';
import 'dart:convert';
import '../models/law.dart';
import '../models/deputy_vote_result.dart';
import '../models/amendement.dart';
import '../services/user_session.dart';
import '../services/amendement_service.dart';
import '../services/law_service.dart';
import '../theme/app_colors.dart';
import '../widgets/amendement_card.dart';
import '../widgets/xp_notification.dart';
import 'dart:collection';
import '../services/api_client.dart';
import 'package:url_launcher/url_launcher.dart';
import 'debate_detail_screen.dart';
import 'package:showcaseview/showcaseview.dart';
import '../widgets/report_error_dialog.dart';
import '../widgets/showcase_helper.dart';

class LawDetailScreen extends StatelessWidget {
  final Law law;

  const LawDetailScreen({super.key, required this.law});

  @override
  Widget build(BuildContext context) {
    return DemokShowcaseWidget(
      onFinish: () => UserSession().setLawShowcaseSeen(),
      builder: (context) => _LawDetailScreenContent(law: law),
    );
  }
}

/// Écran de détail d'une loi permettant de consulter le résumé et de voter.
/// Affiche également les résultats de la communauté et la comparaison avec le député.
class _LawDetailScreenContent extends StatefulWidget {
  final Law law;

  const _LawDetailScreenContent({
    super.key,
    required this.law,
  });

  @override
  State<_LawDetailScreenContent> createState() => _LawDetailScreenContentState();
}

class _LawDetailScreenContentState extends State<_LawDetailScreenContent> {
  bool _hasVoted = false;
  bool _isModifyingVote = false;
  Map<String, dynamic>? _voteResult;
  bool _isSummaryExpanded = false;
  
  // XP Notifications
  final Queue<Map<String, dynamic>> _xpQueue = Queue();
  Map<String, dynamic>? _currentXpNotification;
  bool _isShowingXpNotification = false;

  // Amendements
  List<Amendement> _amendements = [];
  AmendementsStats? _amendementsStats;
  bool _isLoadingAmendements = true;
  String _amendementsFilter = 'TOUS'; // 'TOUS', 'ADOPTE', 'REJETE'
  
  // Amendements Pagination
  int _amendementsPage = 1;
  bool _hasMoreAmendements = true;
  bool _isLoadingMoreAmendements = false;

  bool _isLoadingFavorite = false;

  final ScrollController _scrollController = ScrollController(); // For auto-scroll after vote
  final GlobalKey _debateBtnKey = GlobalKey();
  final GlobalKey _voteButtonsKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _checkVoteStatus();
    _loadAmendements();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!UserSession().hasSeenLawShowcase) {
        Future.delayed(const Duration(milliseconds: 1000), () {
          if (mounted) {
            ShowCaseWidget.of(context).startShowCase([
              _debateBtnKey,
              if (!UserSession().isGuest && ((widget.law.isVotable && !_hasVoted) || _isModifyingVote)) _voteButtonsKey,
            ]);
          }
        });
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  /// Vérifie si l'utilisateur a déjà voté pour cette loi au chargement.
  /// Récupère les stats et le vote du député si applicable.
  Future<void> _checkVoteStatus() async {
    try {
      final userId = UserSession().userId;
      if (userId == null) return;

      final response = await ApiClient.get(
        '/votes/check?lawId=${widget.law.id}',
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['hasVoted'] == true) {
          setState(() {
            _hasVoted = true;
            _voteResult = data;
          });
        }
      }
    } catch (e) {
      debugPrint('Error checking vote status: $e');
    }
  }

  /// Affiche la prochaine notification XP dans la file d'attente
  void _showNextXpNotification() {
    if (_xpQueue.isEmpty || _isShowingXpNotification) return;

    setState(() {
      _currentXpNotification = _xpQueue.removeFirst();
      _isShowingXpNotification = true;
    });
  }

  /// Appelé quand une notification XP se termine
  void _onXpNotificationComplete() {
    setState(() {
      _currentXpNotification = null;
      _isShowingXpNotification = false;
    });

    // Afficher la prochaine notification après un court délai
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) {
        _showNextXpNotification();
      }
    });
  }

  /// Ajoute les gains d'XP à la queue et démarre l'affichage
  void _displayXpGains(List<dynamic>? xpGains) {
    if (xpGains == null || xpGains.isEmpty) return;

    for (var gain in xpGains) {
      _xpQueue.add({
        'amount': gain['amount'],
        'reason': gain['reason'],
      });
    }

    _showNextXpNotification();
  }

  Future<void> _toggleFavorite() async {
    if (UserSession().isGuest) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Inscrivez-vous pour utiliser les favoris !')),
      );
      return;
    }
    if (_isLoadingFavorite) return;
    
    // Optimistic UI update
    setState(() {
      widget.law.isFavorited = !widget.law.isFavorited;
      _isLoadingFavorite = true;
    });

    try {
      final newState = await LawService.toggleFavorite(widget.law.id);
      if (mounted) {
        setState(() {
          widget.law.isFavorited = newState;
          _isLoadingFavorite = false;
        });
      }
    } catch (e) {
      debugPrint("Failed to toggle favorite: $e");
      // Revert upon failure
      if (mounted) {
        setState(() {
          widget.law.isFavorited = !widget.law.isFavorited;
          _isLoadingFavorite = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erreur lors de la mise en favori')),
        );
      }
    }
  }

// ...

  /// Envoie le vote (POUR, CONTRE, ABSTENTION) au backend.
  /// Déclenche l'animation confetti en cas de succès.
  Future<void> _castVote(String choice) async {
    try {
      final userId = UserSession().userId;
       if (userId == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Vous devez être connecté pour voter')),
        );
        return;
      }

      final response = await ApiClient.post(
        '/votes',
        body: {'lawId': widget.law.id, 'choice': choice},
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        // 201 = new vote, 200 = updated vote
        final data = jsonDecode(response.body);
        setState(() {
          _hasVoted = true;
          _isModifyingVote = false; // Reset modification mode
          _voteResult = data;
        });

        // Auto-scroll to top so vote results are visible
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scrollController.hasClients) {
            _scrollController.animateTo(
              0,
              duration: const Duration(milliseconds: 400),
              curve: Curves.easeOut,
            );
          }
        });
        
        // Display XP gains if any
        _displayXpGains(data['xpGains']);
      } else if (response.statusCode == 409) {
        if (mounted) {
           ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Vous avez déjà voté pour cette loi !'),
              backgroundColor: Colors.orange,
            ),
          );
        }
      } else {
        // Show error
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Erreur lors du vote (${response.statusCode})')),
          );
        }
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
    return WillPopScope(
      onWillPop: () async {
        Navigator.pop(context, _hasVoted);
        return false; // We handle popping manually
      },
      child: Stack(
        children: [
          Scaffold(
            backgroundColor: Colors.white,

            appBar: AppBar(
              backgroundColor: Colors.white,
              elevation: 0,
              leading: BackButton(
                onPressed: () => Navigator.pop(context, _hasVoted),
              ),
              iconTheme: const IconThemeData(color: Colors.black),
              actions: [
                IconButton(
                  icon: Icon(
                    widget.law.isFavorited ? Icons.star : Icons.star_border,
                    color: widget.law.isFavorited ? Colors.amber[600] : Colors.grey[400],
                  ),
                  tooltip: 'Mettre en favori',
                  onPressed: _toggleFavorite,
                ),
                DemokShowcase(
                  key: _debateBtnKey,
                  description: "Rejoignez le forum dédié à cette loi pour échanger avec les autres citoyens.",
                  child: IconButton(
                    icon: Icon(Icons.forum_outlined, color: UserSession().isGuest ? Colors.grey[400] : AppColors.primaryBlue),
                    tooltip: 'Voir le débat',
                    onPressed: UserSession().isGuest ? () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Inscrivez-vous pour rejoindre les débats !')),
                      );
                    } : () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => DebateDetailScreen(law: widget.law),
                        ),
                      );
                    },
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.outlined_flag, color: Colors.grey),
                  tooltip: 'Signaler une erreur',
                  onPressed: () async {
                    final result = await showDialog<bool>(
                      context: context,
                      builder: (context) => ReportErrorDialog(lawId: widget.law.id),
                    );
                    if (result == true && mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Merci ! Votre signalement a bien été envoyé.'),
                          backgroundColor: Colors.green,
                        ),
                      );
                    }
                  },
                ),
              ],
            ),
            body: Column(
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Title
                        Text(
                          widget.law.formattedTitle,
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 12),


                        // Résultats du vote des députés AVANT le parcours législatif pour visibilité immédiate
                        if (widget.law.deputyVoteResult != null) ...[
                          _buildDeputyVoteResultSection(widget.law.deputyVoteResult!),
                          const SizedBox(height: 16),
                        ] else if (widget.law.lawStatus == LawStatus.votedAn || 
                                   widget.law.lawStatus == LawStatus.validated || 
                                   widget.law.lawStatus == LawStatus.rejected ||
                                   ((widget.law.voteDate ?? widget.law.agendaDate) != null && 
                                    DateTime((widget.law.voteDate ?? widget.law.agendaDate)!.year, (widget.law.voteDate ?? widget.law.agendaDate)!.month, (widget.law.voteDate ?? widget.law.agendaDate)!.day).isBefore(DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day)))) ...[
                           Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.orange.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: Colors.orange),
                            ),
                            child: Row(
                              children: const [
                                Icon(Icons.info_outline, color: Colors.orange),
                                SizedBox(width: 8),
                                Expanded(child: Text("Résultats du vote en attente de publication officielle", style: TextStyle(color: Colors.orange, fontWeight: FontWeight.bold))),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Parcours législatif
                        _buildLegislativeTimeline(),
                        const SizedBox(height: 16),


                        const SizedBox(height: 16),
                        
                        // Vote results (TOP priority if voted)
                        if (_hasVoted && _voteResult != null) ...[
                          _buildVoteResults(),
                          const SizedBox(height: 24),
                        ],

                        // Résumé Démok
                        if (widget.law.summary != null) ...[
                          _buildSummarySection(),
                        ],

                        // Section Amendements
                        const SizedBox(height: 16),
                        _buildAmendementsSection(),
                      ],
                    ),
                  ),
                ),
                
                if (UserSession().isGuest)
                  _buildGuestBanner()
                else if ((widget.law.isVotable && !_hasVoted) || _isModifyingVote) 
                  _buildVotingButtons(),
              ],
            ),
          ),
            
          // XP Notifications
          if (_currentXpNotification != null)
            XpNotification(
              amount: _currentXpNotification!['amount'],
              reason: _currentXpNotification!['reason'],
              onComplete: _onXpNotificationComplete,
            ),
        ],
      ),
    );
  }

  Widget _buildGuestBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Column(
        children: [
          const Text('Inscrivez-vous pour voter et débattre !', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                UserSession().clearSession();
                Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryBlue,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Créer un compte', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummarySection() {
    return Container(
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
            
            if (!_isSummaryExpanded && !isFirst) return const SizedBox.shrink();
            
            return Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (entry.key != 'default' && entry.key.toLowerCase() != 'résumé')
                    Text(
                      entry.key,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: entry.key.toLowerCase().contains('pour') 
                          ? Colors.green[700] 
                          : (entry.key.toLowerCase().contains('contre') ? Colors.red[700] : AppColors.primaryBlue),
                      ),
                    ),
                  const SizedBox(height: 6),
                  Text(
                    entry.value,
                    maxLines: _isSummaryExpanded ? null : 6,
                    overflow: _isSummaryExpanded ? null : TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      height: 1.5,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
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
                ),
              ),
            ),
          if (widget.law.officialUrl != null || widget.law.latestTextUrl != null) ...[
            const SizedBox(height: 16),
            Center(
              child: InkWell(
                onTap: () async {
                  final urlToLaunch = widget.law.latestTextUrl ?? widget.law.officialUrl!;
                  final url = Uri.parse(urlToLaunch);
                  try {
                     // L'utilisation du mode platformDefault permet d'ouvrir le navigateur
                     // qui saura nativement afficher le PDF au lieu de le télécharger de force.
                     await launchUrl(url, mode: LaunchMode.platformDefault);
                  } catch (e) {
                     debugPrint('Could not launch \$urlToLaunch: \$e');
                     if (context.mounted) {
                       ScaffoldMessenger.of(context).showSnackBar(
                         SnackBar(content: Text('Impossible d\'ouvrir le lien : \$urlToLaunch')),
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
    );
  }

  Widget _buildVoteResults() {
    final stats = _voteResult?['statistics'];
    if (stats == null) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.backgroundSecondary,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Résultats communauté',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 24),
          
          // Horizontal Bars Layout
          Column(
            children: [
              _buildHorizontalBar('Pour', stats['forPercentage'], AppColors.votePour),
              _buildHorizontalBar('Neutre', stats['abstainPercentage'], AppColors.voteAbstention),
              _buildHorizontalBar('Contre', stats['againstPercentage'], AppColors.voteContre),
            ],
          ),
          
          const SizedBox(height: 24),
          Center(
            child: Text(
              '${stats['totalVotes']} votes au total',
              style: const TextStyle(color: AppColors.textSecondary),
            ),
          ),
          
          // Deputy comparison
          if (_voteResult!['deputyVote'] != null) ...[
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 8),
            Text(
              _voteResult!['deputyVote']['agreement']
                  ? '✅ Ton député ${_voteResult!['deputyVote']['deputyName']} a voté comme toi'
                  : '⚠️ Ton député ${_voteResult!['deputyVote']['deputyName']} a voté différemment',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: _voteResult!['deputyVote']['agreement'] ? Colors.green : Colors.orange,
              ),
            ),
          ],
          
          // Modify vote button (only for votable laws: UPCOMING or PENDING)
          if (widget.law.isVotable && !_isModifyingVote) ...[ 
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  setState(() {
                    _isModifyingVote = true;
                  });
                },
                icon: const Icon(Icons.edit, size: 18),
                label: const Text('Modifier mon vote'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primaryBlue,
                  side: const BorderSide(color: AppColors.primaryBlue),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildHorizontalBar(String label, dynamic percentageVal, Color color) {
    final double percentage = (percentageVal as num).toDouble();

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        children: [
          SizedBox(
            width: 60,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
          ),
          Expanded(
            child: Stack(
              children: [
                Container(
                  height: 12,
                  decoration: BoxDecoration(
                    color: Colors.grey[200],
                    borderRadius: BorderRadius.circular(6),
                  ),
                ),
                LayoutBuilder(
                  builder: (context, constraints) {
                    return TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0, end: percentage),
                      duration: const Duration(milliseconds: 1000),
                      curve: Curves.easeOutQuart,
                      builder: (context, value, child) {
                        return Container(
                          height: 12,
                          width: constraints.maxWidth * (value / 100),
                          decoration: BoxDecoration(
                            color: color,
                            borderRadius: BorderRadius.circular(6),
                          ),
                        );
                      },
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 50,
            child: Text(
              '${percentage.toStringAsFixed(1)}%',
              textAlign: TextAlign.right,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVotingButtons() {
    return DemokShowcase(
      key: _voteButtonsKey,
      description: "C'est votre moment démocratique ! Votez pour donner votre avis sur ce texte.",
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.1),
              blurRadius: 10,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: Row(
          children: [
            _buildLawChoiceButton('FOR', 'Pour', AppColors.votePour, Icons.thumb_up_rounded),
            const SizedBox(width: 8),
            _buildLawChoiceButton('ABSTAIN', 'Neutre', AppColors.voteAbstention, Icons.remove_circle_outline_rounded),
            const SizedBox(width: 8),
            _buildLawChoiceButton('AGAINST', 'Contre', AppColors.voteContre, Icons.thumb_down_rounded),
          ],
        ),
      ),
    );
  }

  Widget _buildLawChoiceButton(String choice, String label, Color color, IconData icon) {
    return Expanded(
      child: GestureDetector(
        onTap: () => _castVote(choice),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: color.withAlpha(25),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withAlpha(100)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: color, size: 22),
              const SizedBox(height: 4),
              Text(label, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _loadAmendements({bool loadMore = false}) async {
    if (loadMore) {
      if (_isLoadingMoreAmendements || !_hasMoreAmendements) return;
      setState(() => _isLoadingMoreAmendements = true);
      _amendementsPage++;
    } else {
      _amendementsPage = 1;
      _hasMoreAmendements = true;
      if (!_isLoadingAmendements) setState(() => _isLoadingAmendements = true);
    }

    try {
      final String? filter = _amendementsFilter == 'TOUS' ? null : _amendementsFilter;
      final results = await Future.wait([
        AmendementService.fetchAmendements(widget.law.id, limit: 10, page: _amendementsPage, statut: filter),
        if (!loadMore) AmendementService.fetchStats(widget.law.id),
      ]);
      
      if (mounted) {
        setState(() {
          final newItems = results[0] as List<Amendement>;
          if (loadMore) {
             _amendements.addAll(newItems);
             _isLoadingMoreAmendements = false;
          } else {
             _amendements = newItems;
             _amendementsStats = results[1] as AmendementsStats?;
             _isLoadingAmendements = false;
          }
          if (newItems.length < 10) {
             _hasMoreAmendements = false;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingAmendements = false;
          _isLoadingMoreAmendements = false;
        });
      }
    }
  }

  Widget _buildAmendementsSection() {
    // Masquer la section si aucun amendement et chargement terminé
    if (!_isLoadingAmendements && _amendements.isEmpty) return const SizedBox.shrink();

    final stats = _amendementsStats;
    final adoptes = stats?.parStatut['ADOPTE'] ?? 0;
    final rejetes = stats?.parStatut['REJETE'] ?? 0;
    final enDiscussion = stats?.parStatut['EN_DISCUSSION'] ?? 0;
    final total = stats?.total ?? _amendements.length;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4, offset: const Offset(0, 2)),
        ],
      ),
      child: ExpansionTile(
        initiallyExpanded: false,
        title: Row(
          children: [
            const Icon(Icons.edit_note, color: AppColors.primaryBlue, size: 20),
            const SizedBox(width: 8),
            const Text('Amendements',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.darkBlue)),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => _showAmendementStatusInfo(context),
              child: const Icon(Icons.info_outline, color: Colors.grey, size: 20),
            ),
            const Spacer(),
            if (total > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primaryBlue.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text('$total',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primaryBlue)),
              ),
          ],
        ),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        children: [
          if (_isLoadingAmendements)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            )
          else ...[
            // Stats chips
            if (total > 0) ...[
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _buildStatChip('✅ Adoptés', adoptes, const Color(0xFF2E7D32), const Color(0xFFE8F5E9)),
                  _buildStatChip('❌ Rejetés', rejetes, const Color(0xFFC62828), const Color(0xFFFFEBEE)),
                  if (enDiscussion > 0)
                    _buildStatChip('💬 En discussion', enDiscussion, AppColors.primaryBlue, const Color(0xFFE3F2FD)),
                ],
              ),
              const SizedBox(height: 12),
            ],
            // Filtres
            if (total > 0) ...[
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: ['TOUS', 'ADOPTE', 'REJETE'].map((f) {
                    final isSelected = _amendementsFilter == f;
                    final label = f == 'TOUS' ? 'Tous' : f == 'ADOPTE' ? 'Adoptés' : 'Rejetés';
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(label),
                        selected: isSelected,
                        onSelected: (_) {
                          if (!isSelected) {
                            setState(() => _amendementsFilter = f);
                            _loadAmendements();
                          }
                        },
                        selectedColor: AppColors.primaryBlue.withValues(alpha: 0.15),
                        checkmarkColor: AppColors.primaryBlue,
                        labelStyle: TextStyle(
                          color: isSelected ? AppColors.primaryBlue : AppColors.textSecondary,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          fontSize: 13,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 12),
            ],
            // Liste
            if (_amendements.isEmpty)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Center(
                  child: Text(
                    _amendementsFilter == 'TOUS'
                        ? 'Aucun amendement disponible'
                        : 'Aucun amendement dans cette catégorie',
                    style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
                  ),
                ),
              )
            else ...[
              ..._amendements.map((a) => AmendementCard(amendement: a)),
              if (_hasMoreAmendements)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: _isLoadingMoreAmendements 
                    ? const Center(child: CircularProgressIndicator()) 
                    : SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: () => _loadAmendements(loadMore: true),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.primaryBlue,
                            side: const BorderSide(color: AppColors.primaryBlue),
                          ),
                          child: const Text('Charger plus'),
                        ),
                      ),
                ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildStatChip(String label, int count, Color textColor, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(20)),
      child: Text('$label ($count)',
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: textColor)),
    );
  }

  void _showAmendementStatusInfo(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Statuts des amendements', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildStatusRow('Adopté', 'L\'amendement a été voté et intégré au texte de loi.', const Color(0xFF2E7D32)),
              const SizedBox(height: 12),
              _buildStatusRow('Rejeté', 'L\'amendement n\'a pas recueilli une majorité de votes et n\'est pas intégré.', const Color(0xFFC62828)),
              const SizedBox(height: 12),
              _buildStatusRow('En discussion', 'L\'amendement n\'a pas encore été examiné ou voté.', AppColors.primaryBlue),
              const SizedBox(height: 12),
              _buildStatusRow('Non soutenu / Non défendu', 'L\'auteur (ou un des signataires) n\'était pas présent pour le présenter, l\'amendement est donc écarté.', Colors.grey.shade700),
              const SizedBox(height: 12),
              _buildStatusRow('Tombé', 'L\'amendement n\'a plus lieu d\'être car un amendement précédent ou un vote sur l\'article rend sa discussion impossible.', Colors.grey.shade700),
              const SizedBox(height: 12),
              _buildStatusRow('Retiré', 'L\'auteur a décidé de retirer son amendement avant ou pendant son examen.', Colors.grey.shade700),
              const SizedBox(height: 12),
              _buildStatusRow('Irrecevable', 'L\'amendement ne respecte pas les critères constitutionnels ou réglementaires.', Colors.grey.shade700),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Compris', style: TextStyle(color: AppColors.primaryBlue, fontWeight: FontWeight.bold)),
          ),
        ],
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    );
  }

  Widget _buildStatusRow(String status, String description, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Icon(Icons.circle, size: 10, color: color),
            const SizedBox(width: 8),
            Text(status, style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 15)),
          ],
        ),
        const SizedBox(height: 4),
        Text(description, style: const TextStyle(fontSize: 13, height: 1.4, color: AppColors.textPrimary)),
      ],
    );
  }

  Widget _buildLegislativeTimeline() {
    final lawStatus = widget.law.lawStatus;

    // Étape active dans la timeline (0=Dépôt, 1=Examen, 2=Vote AN, 3=Sénat, 4=Validée)
    int currentStep = 1;
    switch (lawStatus) {
      case LawStatus.upcoming:
      case LawStatus.pending:
        currentStep = 1;
        break;
      case LawStatus.votedAn:
        currentStep = 2;
        break;
      case LawStatus.atSenate:
        currentStep = 3;
        break;
      case LawStatus.validated:
      case LawStatus.rejected:
        currentStep = 4;
        break;
    }

    // Badge de statut
    String statusText = widget.law.statusLabel;
    Color statusColor = const Color(0xFF1565C0);
    switch (lawStatus) {
      case LawStatus.upcoming:
        statusColor = const Color(0xFF1565C0); // Bleu
        break;
      case LawStatus.pending:
        statusColor = const Color(0xFFE65100); // Orange
        break;
      case LawStatus.votedAn:
        statusColor = const Color(0xFF1565C0); // Bleu foncé
        break;
      case LawStatus.atSenate:
        statusColor = const Color(0xFF6A1B9A); // Violet
        break;
      case LawStatus.validated:
        statusColor = const Color(0xFF2E7D32); // Vert
        break;
      case LawStatus.rejected:
        statusColor = const Color(0xFFC62828); // Rouge
        break;
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ExpansionTile(
        title: Row(
          children: [
            const Icon(Icons.account_balance, color: AppColors.primaryBlue, size: 20),
            const SizedBox(width: 8),
            const Expanded(
              child: Text(
                'Parcours & Détails',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.darkBlue),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        initiallyExpanded: false,
        childrenPadding: const EdgeInsets.all(16),
        children: [
          // Timeline Row
          Row(
            children: [
              _buildTimelineStep(
                0, 'Dépôt', currentStep >= 0, true,
                subtitle: (widget.law.source == 'AN' || widget.law.source.toLowerCase().startsWith('ass')) ? 'AN' : 'Sénat',
              ),
              _buildTimelineLine(currentStep >= 1),
              _buildTimelineStep(1, 'Lectures', currentStep >= 1, false,
                  subtitle: widget.law.navetteCount > 0 ? '×${widget.law.navetteCount}' : null),
              _buildTimelineLine(currentStep >= 2),
              _buildTimelineStep(
                2, 
                lawStatus == LawStatus.rejected ? 'Rejetée' : 'Adoptée (AN)', 
                currentStep >= 2, 
                true,
                isRejected: lawStatus == LawStatus.rejected,
              ),
            ],
          ),
          
          const SizedBox(height: 20),
          
          // Details Grid
          SizedBox(
            width: double.infinity,
            child: Wrap(
              spacing: 24,
              runSpacing: 12,
              children: [
                 if (widget.law.dateDepot != null)
                  _buildDetailItem(Icons.calendar_today, 'Dépôt', _formatDate(widget.law.dateDepot!)),
  
               Builder(
                 builder: (context) {
                   DateTime? displayDate = widget.law.agendaDate ?? widget.law.voteDate;
                   if (displayDate == null) return const SizedBox.shrink();
                   
                   bool isPast = DateTime(displayDate.year, displayDate.month, displayDate.day)
                       .isBefore(DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day));
                   
                   return _buildDetailItem(
                     Icons.how_to_vote, 
                     isPast ? 'Votée le' : 'Vote le', 
                     _formatDate(displayDate)
                   );
                 }
               ),
                 
                 if (widget.law.datePromulgation != null)
                  _buildDetailItem(Icons.verified, 'Promulguée le', _formatDate(widget.law.datePromulgation!)),
  
                 if (widget.law.procedureAcceleree)
                  _buildDetailItem(Icons.speed, 'Procédure', 'Accélérée'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeputyVoteResultSection(DeputyVoteResult result) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: result.adopted ? const Color(0xFFE8F5E9) : const Color(0xFFFFEBEE),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: result.adopted ? const Color(0xFF2E7D32) : const Color(0xFFC62828),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                result.adopted ? Icons.how_to_vote : Icons.cancel_outlined,
                size: 18,
                color: result.adopted ? const Color(0xFF2E7D32) : const Color(0xFFC62828),
              ),
              const SizedBox(width: 6),
              Text(
                result.adopted ? 'Adoptée par l\'AN' : 'Rejetée par l\'AN',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: result.adopted ? const Color(0xFF2E7D32) : const Color(0xFFC62828),
                ),
              ),
              const Spacer(),
              Text(
                '${result.total} votants',
                style: const TextStyle(fontSize: 11, color: Colors.grey),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (result.isSimplified)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 4),
              child: Text(
                "Adopté sans scrutin public (procédure d'examen simplifiée). Les votes individuels ne sont pas enregistrés électroniquement.",
                style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Colors.black54),
              ),
            )
          else
            Row(
              children: [
                _buildDeputyVoteBar('Pour', result.pour, result.total, const Color(0xFF2E7D32)),
                const SizedBox(width: 8),
                _buildDeputyVoteBar('Contre', result.contre, result.total, const Color(0xFFC62828)),
                const SizedBox(width: 8),
                _buildDeputyVoteBar('Abst.', result.abstention, result.total, Colors.grey),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildDeputyVoteBar(String label, int count, int total, Color color) {
    return Expanded(
      child: Column(
        children: [
          Text(
            '$count',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: color),
          ),
          const SizedBox(height: 2),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: total > 0 ? count / total : 0,
              backgroundColor: color.withValues(alpha: 0.15),
              valueColor: AlwaysStoppedAnimation<Color>(color),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey)),
        ],
      ),
    );
  }

  Widget _buildTimelineStep(int index, String label, bool isActive, bool isOuter, {String? subtitle, bool isRejected = false}) {
    
    Color activeColor = isRejected ? const Color(0xFFC62828) : AppColors.primaryBlue;

    return Expanded(
      child: Column(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: isActive ? activeColor : Colors.white,
              shape: BoxShape.circle,
              border: Border.all(color: isActive ? activeColor : Colors.grey.shade300, width: 2),
            ),
            child: isActive 
              ? Icon(isRejected ? Icons.close : Icons.check, size: 16, color: Colors.white)
              : null,
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
              color: isActive ? activeColor : Colors.black54,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.visible,
            softWrap: false,
          ),
          if (subtitle != null) ...[
             const SizedBox(height: 2),
             Text(
               subtitle,
               style: const TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.w500),
               textAlign: TextAlign.center,
               maxLines: 1,
               overflow: TextOverflow.visible,
             ),
          ]
        ],
      ),
    );
  }
  
  Widget _buildTimelineLine(bool isActive) {
    return Expanded(
      child: Container(
        height: 2,
        color: isActive ? AppColors.primaryBlue : Colors.grey.shade300,
        margin: const EdgeInsets.only(bottom: 20), // Align with circle center (approx)
      ),
    );
  }

  Widget _buildDetailItem(IconData icon, String label, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: Colors.grey.shade600),
        const SizedBox(width: 6),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey)),
            Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
          ],
        ),
      ],
    );
  }
  
  String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }
}
