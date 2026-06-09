import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import '../models/deputy.dart';
import '../services/deputies_service.dart';
import '../services/deputies_service.dart';
import '../theme/app_colors.dart';
import '../config/env.dart';

class DeputyDetailScreen extends StatefulWidget {
  final Deputy deputy;

  const DeputyDetailScreen({super.key, required this.deputy});

  @override
  State<DeputyDetailScreen> createState() => _DeputyDetailScreenState();
}

class _DeputyDetailScreenState extends State<DeputyDetailScreen> {
  List<DeputyVote> _votes = [];
  bool _isLoading = true;
  Map<String, dynamic>? _stats;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final votesFuture = DeputiesService.getDeputyVotes(widget.deputy.id, limit: 10);
      final statsFuture = DeputiesService.getDeputyStats(widget.deputy.id);
      
      final results = await Future.wait([votesFuture, statsFuture]);
      
      setState(() {
        _votes = results[0] as List<DeputyVote>;
        _stats = results[1] as Map<String, dynamic>?;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showStatInfo(String title, String content) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Text(content),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }



  Widget _buildVoteIcon(String choice) {
    if (choice == 'pour') {
      return const Icon(Icons.thumb_up, color: Colors.green);
    } else if (choice == 'contre') {
      return const Icon(Icons.thumb_down, color: Colors.red);
    } else {
      return const Icon(Icons.thumbs_up_down, color: Colors.grey);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dep = widget.deputy;
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: Text(dep.fullName, style: const TextStyle(color: Colors.black)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (dep.isActive != null && !dep.isActive!)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.red[50],
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.red[200]!),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.warning_amber_rounded, color: Colors.red),
                    SizedBox(width: 8),
                    Text(
                      'Ancien Député (Fin de mandat)',
                      style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                  ],
                ),
              ),
            ClipOval(
              child: Container(
                width: 120,
                height: 120,
                color: Colors.grey[200],
                child: dep.photoUrl != null
                    ? Image.network(
                        dep.photoUrl!.startsWith('http') 
                          ? dep.photoUrl! 
                          : '${Env.apiUrl.replaceAll('/api', '')}${dep.photoUrl!}',
                        headers: kDebugMode ? const {'Bypass-Tunnel-Reminder': 'true'} : null,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) {
                          return const Icon(Icons.person, size: 60, color: Colors.grey);
                        },
                      )
                    : const Icon(Icons.person, size: 60, color: Colors.grey),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              dep.fullName,
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            if (dep.party != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.primaryBlue.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  dep.party!,
                  style: const TextStyle(color: AppColors.primaryBlue, fontWeight: FontWeight.bold),
                ),
              ),
            const SizedBox(height: 16),
            if (dep.department != null)
              Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.location_on, color: Colors.grey),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          dep.department!,
                          style: const TextStyle(fontSize: 16, color: Colors.black87),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ],
                  ),
                  if (!_isLoading && _stats != null && _stats!['mandateStartDate'] != null)
                    Builder(builder: (context) {
                      try {
                        final date = DateTime.parse(_stats!['mandateStartDate']);
                        return Padding(
                          padding: const EdgeInsets.only(top: 4.0),
                          child: Text(
                            "Depuis le ${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}",
                            style: TextStyle(fontSize: 13, color: Colors.grey[600], fontStyle: FontStyle.italic),
                          ),
                        );
                      } catch (_) {
                        return const SizedBox.shrink();
                      }
                    }),
                ],
              ),
            const SizedBox(height: 16),
            if (!_isLoading && _stats != null)
              Wrap(
                spacing: 12,
                runSpacing: 8,
                alignment: WrapAlignment.center,
                children: [
                  if (_stats!['presenceScore'] != null)
                    Builder(builder: (context) {
                      final presenceScore = _stats!['presenceScore'] as int;
                      final displayLabel = '$presenceScore% Présence';

                      return ActionChip(
                        avatar: const Icon(Icons.info_outline, size: 16, color: Colors.white),
                        label: Text(displayLabel),
                        labelStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        backgroundColor: AppColors.primaryBlue,
                        onPressed: () {
                          final moy = _stats?['presenceMoyenne'] != null ? "\n\nMoyenne de son groupe : ${_stats!['presenceMoyenne']}%." : "";
                          final desc = "Taux de participation aux scrutins publics solennels.\n\nCes scrutins correspondent aux votes les plus importants de l'Assemblée (votes finaux sur l'ensemble d'une loi, motions de censure, etc.) où la présence des députés est fortement attendue par leurs groupes politiques.$moy";
                              
                          _showStatInfo("Présence solennelle", desc);
                        },
                      );
                    }),
                  if (_stats!['loyaute'] != null)
                    ActionChip(
                      avatar: const Icon(Icons.info_outline, size: 16, color: Colors.white),
                      label: Text('${_stats!['loyaute']}% Loyauté'),
                      labelStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      backgroundColor: Colors.purple,
                      onPressed: () {
                        _showStatInfo(
                          "Taux de loyauté", 
                          "Ce pourcentage indique à quelle fréquence le député vote en accord avec la majorité de son groupe parlementaire. Plus il est proche de 100%, plus il suit les consignes de son groupe."
                        );
                      },
                    ),
                  if (_stats!['votesCount'] != null && _stats!['votesCount'] > 0)
                    ActionChip(
                      avatar: const Icon(Icons.info_outline, size: 16, color: Colors.white),
                      label: Text('${_stats!['votesCount']} votes'),
                      labelStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      backgroundColor: Colors.teal,
                      onPressed: () {
                        String datePrecision = "depuis le début de la législature";
                        if (_stats!['mandateStartDate'] != null) {
                            try {
                              final date = DateTime.parse(_stats!['mandateStartDate']);
                              datePrecision = "depuis sa prise de poste le ${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}";
                            } catch (_) {}
                        }
                        _showStatInfo(
                          "Participation aux votes", 
                          "Le nombre total de scrutins publics auxquels le député a participé (voté pour, contre ou abstention) $datePrecision."
                        );
                      },
                    ),
                  if (_stats!['statsAmendements'] != null && _stats!['statsAmendements'] > 0)
                    ActionChip(
                      avatar: const Icon(Icons.info_outline, size: 16, color: Colors.white),
                      label: Text('${_stats!['statsAmendements']} amendements'),
                      labelStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      backgroundColor: Colors.orange,
                      onPressed: () {
                        final adoptes = _stats!['statsAmendementsAdoptes'] ?? 0;
                        _showStatInfo(
                          "Amendements proposés", 
                          "Ce député a déposé ${_stats!['statsAmendements']} amendements depuis le début de la législature.\n\nParmi eux, $adoptes ont été adoptés par l'Assemblée."
                        );
                      },
                    ),
                  if (_stats!['statsQuestions'] != null && _stats!['statsQuestions'] > 0)
                    ActionChip(
                      avatar: const Icon(Icons.info_outline, size: 16, color: Colors.white),
                      label: Text('${_stats!['statsQuestions']} questions'),
                      labelStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      backgroundColor: Colors.indigo,
                      onPressed: () {
                        _showStatInfo(
                          "Questions au Gouvernement", 
                          "Le nombre de fois où le député a interpellé officiellement un ministre pour l'interroger sur l'action du Gouvernement."
                        );
                      },
                    ),
                ],
              ),
            const SizedBox(height: 24),
            if (dep.bio != null) ...[
              const Align(
                alignment: Alignment.centerLeft,
                child: Text('Informations', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(dep.bio!, style: const TextStyle(fontSize: 16)),
              ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  "Données mises à jour quotidiennement. Résumés actualisés toutes les 2 semaines.",
                  style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Colors.grey),
                ),
              ),
              const SizedBox(height: 24),
            ],
            const Align(
              alignment: Alignment.centerLeft,
              child: Text('Derniers votes', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 16),
            if (_isLoading)
              const Center(child: CircularProgressIndicator())
            else if (_votes.isEmpty)
              const Center(child: Text("Aucun vote récent trouvé pour ce député."))
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _votes.length,
                itemBuilder: (context, index) {
                  final vote = _votes[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: ListTile(
                      leading: _buildVoteIcon(vote.choice),
                      title: Text(
                        vote.lawTitle,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      subtitle: vote.voteDate != null 
                        ? Text("${vote.voteDate!.day}/${vote.voteDate!.month}/${vote.voteDate!.year}")
                        : null,
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}
