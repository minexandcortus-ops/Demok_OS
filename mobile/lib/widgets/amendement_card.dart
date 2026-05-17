import 'package:flutter/material.dart';
import '../models/amendement.dart';
import '../theme/app_colors.dart';

/// Widget card pour afficher un amendement dans une liste.
class AmendementCard extends StatefulWidget {
  final Amendement amendement;

  const AmendementCard({super.key, required this.amendement});

  @override
  State<AmendementCard> createState() => _AmendementCardState();
}

class _AmendementCardState extends State<AmendementCard> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: numéro + statut badge
            Row(
              children: [
                Icon(Icons.article_outlined, size: 18, color: Colors.grey.shade600),
                const SizedBox(width: 6),
                Text(
                  'Amendement n°${widget.amendement.numero}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                const Spacer(),
                _buildStatutBadge(),
              ],
            ),
            const SizedBox(height: 8),

            // Auteur
            Row(
              children: [
                Icon(Icons.person_outline, size: 16, color: Colors.grey.shade500),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    widget.amendement.auteur,
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey.shade700,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),

            if ((widget.amendement.resume?.isNotEmpty == true) || (widget.amendement.texte?.isNotEmpty == true)) ...[
              const SizedBox(height: 8),
              InkWell(
                onTap: () {
                  setState(() {
                    _isExpanded = !_isExpanded;
                  });
                },
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.amendement.resume?.isNotEmpty == true
                            ? widget.amendement.resume!
                            : widget.amendement.texte!,
                        style: TextStyle(
                          fontSize: 13,
                          color: widget.amendement.resume?.isNotEmpty == true ? Colors.grey.shade800 : Colors.grey.shade600,
                          fontStyle: widget.amendement.resume?.isNotEmpty == true ? FontStyle.italic : FontStyle.normal,
                          height: 1.4,
                        ),
                        maxLines: _isExpanded ? null : 3,
                        overflow: _isExpanded ? null : TextOverflow.ellipsis,
                      ),
                      Builder(
                        builder: (context) {
                          final content = widget.amendement.resume?.isNotEmpty == true
                              ? widget.amendement.resume!
                              : widget.amendement.texte!;
                          if (content.length > 150) {
                            return Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    _isExpanded ? Icons.expand_less : Icons.expand_more,
                                    size: 18,
                                    color: Colors.grey.shade400,
                                  ),
                                ],
                              ),
                            );
                          }
                          return const SizedBox.shrink();
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatutBadge() {
    Color bgColor;
    Color textColor;

    switch (widget.amendement.statut) {
      case 'ADOPTE':
        bgColor = const Color(0xFFE8F5E9);
        textColor = const Color(0xFF2E7D32);
        break;
      case 'REJETE':
        bgColor = const Color(0xFFFFEBEE);
        textColor = const Color(0xFFC62828);
        break;
      case 'RETIRE':
        bgColor = Colors.grey.shade100;
        textColor = Colors.grey.shade700;
        break;
      case 'TOMBE':
        bgColor = const Color(0xFFFFF3E0);
        textColor = const Color(0xFFE65100);
        break;
      case 'NON_DEFENDU':
        bgColor = Colors.grey.shade100;
        textColor = Colors.grey.shade500;
        break;
      default: // EN_DISCUSSION
        bgColor = const Color(0xFFE3F2FD);
        textColor = AppColors.primaryBlue;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        widget.amendement.statutLabel,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: textColor,
        ),
      ),
    );
  }
}
