import 'package:flutter/material.dart';
import '../data/government_data.dart';
import '../services/government_service.dart';
import '../theme/app_colors.dart';

class GovernmentModal extends StatefulWidget {
  const GovernmentModal({super.key});

  @override
  State<GovernmentModal> createState() => _GovernmentModalState();
}

class _GovernmentModalState extends State<GovernmentModal> {
  List<GovernmentMember>? _governmentMembers;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final members = await GovernmentService.fetchGovernmentComposition();
      if (mounted) {
        setState(() {
          _governmentMembers = members;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // Drag handle
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),
              // Header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primaryBlue.withAlpha(20),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.account_balance, color: AppColors.primaryBlue, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Gouvernement',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1A1A2E),
                            ),
                          ),
                          Text(
                            'Source: data.gouv.fr (mis à jour quotidiennement)',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey[600],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              const Divider(),
              // List
              Expanded(
                child: _isLoading 
                    ? const Center(child: CircularProgressIndicator())
                    : _error != null 
                        ? Center(child: Text(_error!, textAlign: TextAlign.center))
                        : ListView.builder(
                            controller: scrollController,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            itemCount: _governmentMembers?.length ?? 0,
                            itemBuilder: (context, index) {
                              final member = _governmentMembers![index];
                              return _GovernmentMemberTile(member: member);
                            },
                          ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _GovernmentMemberTile extends StatelessWidget {
  final GovernmentMember member;
  const _GovernmentMemberTile({required this.member});

  @override
  Widget build(BuildContext context) {
    Color badgeColor;
    Color badgeBg;
    String? badgeLabel;
    IconData avatarIcon;

    if (member.isPresident) {
      badgeColor = const Color(0xFF003189);
      badgeBg = const Color(0xFFE8EDF9);
      badgeLabel = 'Président';
      avatarIcon = Icons.star_rounded;
    } else if (member.isPM) {
      badgeColor = const Color(0xFF1565C0);
      badgeBg = const Color(0xFFE3F2FD);
      badgeLabel = 'Premier Ministre';
      avatarIcon = Icons.account_balance;
    } else if (member.isMinisterEtat) {
      badgeColor = const Color(0xFF6A1B9A);
      badgeBg = const Color(0xFFF3E5F5);
      badgeLabel = "Ministre d'État";
      avatarIcon = Icons.workspace_premium;
    } else {
      badgeColor = Colors.grey[700]!;
      badgeBg = Colors.grey[100]!;
      badgeLabel = null;
      avatarIcon = Icons.person_outline;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: badgeBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(avatarIcon, color: badgeColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      member.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: Color(0xFF1A1A2E),
                      ),
                    ),
                    if (badgeLabel != null) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: badgeBg,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: badgeColor.withAlpha(60)),
                        ),
                        child: Text(
                          badgeLabel,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            color: badgeColor,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  member.role,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
