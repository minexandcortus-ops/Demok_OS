import 'package:flutter/material.dart';
import '../models/law.dart';
import '../services/law_service.dart';
import 'package:timeago/timeago.dart' as timeago;

class LawCard extends StatefulWidget {
  final Law law;
  final VoidCallback onTap;

  const LawCard({
    super.key,
    required this.law,
    required this.onTap,
  });

  @override
  State<LawCard> createState() => _LawCardState();
}

class _LawCardState extends State<LawCard> {
  bool _isLoadingFavorite = false;

  Future<void> _toggleFavorite() async {
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

  @override
  Widget build(BuildContext context) {
    final law = widget.law;
    final onTap = widget.onTap;
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header with badges
              Row(
                children: [
                  if (law.source.toLowerCase().contains('ue') || law.source.toLowerCase().contains('europ')) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.blue[100],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'UE',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.blue[800],
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Builder(builder: (context) {
                    String badgeText = law.statusLabel;
                    Color bgCol = Colors.orange[100]!;
                    Color textCol = Colors.orange[800]!;

                    if (law.lawStatus == LawStatus.votedAn || law.lawStatus == LawStatus.validated) {
                      bgCol = Colors.green[100]!;
                      textCol = Colors.green[800]!;
                    } else if (law.lawStatus == LawStatus.rejected) {
                      bgCol = Colors.red[100]!;
                      textCol = Colors.red[800]!;
                    }

                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: bgCol,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        badgeText,
                        style: TextStyle(
                          fontSize: 12,
                          color: textCol,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    );
                  }),
                  const Spacer(),
                  if (law.userVote != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(
                        color: Colors.deepPurple,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.how_to_vote, size: 16, color: Colors.white),
                    ),
                  // Favorite Star Button
                  SizedBox(
                    width: 32,
                    height: 32,
                    child: IconButton(
                      padding: EdgeInsets.zero,
                      icon: Icon(
                        law.isFavorited ? Icons.star : Icons.star_border,
                        color: law.isFavorited ? Colors.amber[600] : Colors.grey[400],
                        size: 26,
                      ),
                      onPressed: _toggleFavorite,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              
              // Title
              Text(
                law.formattedTitle,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 8),
              
              // Pitch (simplified for now)
              Text(
                law.titleOfficial,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[600],
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              
              // Date and statistics row
              const SizedBox(height: 12),
              Row(
                children: [
                  Builder(
                    builder: (context) {
                      // Pour les lois votées/adoptées/rejetées : on affiche la date du VOTE.
                      // Pour les lois en discussion ou à venir : on affiche la date de l'agenda.
                      // Fallback final : date de dépôt du texte (dateDepot).
                      final isResolved = law.lawStatus == LawStatus.votedAn ||
                          law.lawStatus == LawStatus.validated ||
                          law.lawStatus == LawStatus.rejected;
                      DateTime? displayDate = isResolved
                          ? (law.voteDate ?? law.agendaDate ?? law.dateDepot)
                          : (law.agendaDate ?? law.voteDate ?? law.dateDepot);
                      final bool isDepotFallback = displayDate != null &&
                          displayDate == law.dateDepot &&
                          law.agendaDate == null &&
                          law.voteDate == null;
                      if (displayDate == null) return const SizedBox.shrink();


                      String label;
                      IconData icon;

                      DateTime now = DateTime.now();
                      DateTime today = DateTime(now.year, now.month, now.day);
                      DateTime dateOnly = DateTime(displayDate.year, displayDate.month, displayDate.day);

                      if (isDepotFallback) {
                          // Aucune date de vote/agenda : on affiche la date de dépôt du texte
                          label = 'Déposée';
                          icon = Icons.inbox_outlined;
                      } else if (dateOnly.isBefore(today)) {
                          if (law.lawStatus == LawStatus.pending) {
                              label = 'Discussion';
                              icon = Icons.hourglass_empty;
                          } else {
                              label = 'Votée';
                              icon = Icons.how_to_vote;
                          }
                      } else {
                          label = 'Vote';
                          icon = Icons.calendar_today;
                      }

                      String relativeDate;
                      if (!dateOnly.isBefore(today)) {
                        final diff = dateOnly.difference(today).inDays;
                        if (diff == 0) {
                          relativeDate = "aujourd'hui";
                        } else if (diff == 1) {
                          relativeDate = "demain";
                        } else {
                          relativeDate = "dans $diff jours";
                        }
                      } else {
                        relativeDate = timeago.format(displayDate, locale: 'fr', allowFromNow: true);
                      }

                      return Row(
                        children: [
                          Icon(icon, size: 14, color: Colors.grey[600]),
                          const SizedBox(width: 4),
                          Text(
                            '$label $relativeDate',
                            style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                          ),
                        ],
                      );
                    }
                  ),
                  
                  if (law.statistics != null && law.statistics!.totalVotes > 0) ...[
                    const SizedBox(width: 16),
                    Icon(Icons.people, size: 16, color: Colors.grey[600]),
                    const SizedBox(width: 4),
                    Text(
                      '${law.statistics!.totalVotes} votes',
                      style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
