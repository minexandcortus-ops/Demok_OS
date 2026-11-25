import 'package:flutter/material.dart';
import '../models/group_vote.dart';
import '../services/law_service.dart';
import '../theme/app_colors.dart';

const _pourColor = Color(0xFF15803D);
const _contreColor = Color(0xFFB91C1C);
const _abstColor = Color(0xFF64748B);

Color positionColor(String position) => switch (position) {
      'FOR' => _pourColor,
      'AGAINST' => _contreColor,
      'ABSTAIN' => _abstColor,
      _ => AppColors.warning,
    };

/// « Comment ont voté les groupes ? » : une barre empilée par groupe,
/// sa position majoritaire, et la liste dépliable des députés qui s'en sont écartés.
class GroupVotesSection extends StatefulWidget {
  final String lawId;

  /// Source des données (remplaçable dans les tests).
  final Future<List<GroupVote>> Function(String lawId) loader;

  const GroupVotesSection(
      {super.key,
      required this.lawId,
      this.loader = LawService.fetchGroupVotes});

  @override
  State<GroupVotesSection> createState() => _GroupVotesSectionState();
}

class _GroupVotesSectionState extends State<GroupVotesSection> {
  late Future<List<GroupVote>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.loader(widget.lawId).catchError((_) => <GroupVote>[]);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<GroupVote>>(
      future: _future,
      builder: (context, snapshot) {
        final groups = snapshot.data ?? const [];
        if (snapshot.connectionState != ConnectionState.done ||
            groups.isEmpty) {
          return const SizedBox.shrink();
        }
        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Material(
            color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: AppColors.cardBorder),
            ),
            clipBehavior: Clip.antiAlias,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Vote des groupes politiques',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary)),
                  const SizedBox(height: 4),
                  const Text(
                      'Position majoritaire de chaque groupe et députés qui s\'en sont écartés.',
                      style: TextStyle(
                          fontSize: 12, color: AppColors.textSecondary)),
                  const SizedBox(height: 12),
                  const _Legend(),
                  const SizedBox(height: 8),
                  ...groups.map((g) => _GroupRow(group: g)),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend();

  @override
  Widget build(BuildContext context) {
    Widget dot(Color c, String l) =>
        Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
          const SizedBox(width: 4),
          Text(l,
              style: const TextStyle(
                  fontSize: 11, color: AppColors.textSecondary)),
        ]);
    return Wrap(spacing: 12, children: [
      dot(_pourColor, 'Pour'),
      dot(_contreColor, 'Contre'),
      dot(_abstColor, 'Abstention')
    ]);
  }
}

class _GroupRow extends StatelessWidget {
  final GroupVote group;

  const _GroupRow({required this.group});

  @override
  Widget build(BuildContext context) {
    final total = group.expressed;
    Widget segment(int count, Color color) => count == 0
        ? const SizedBox.shrink()
        : Expanded(flex: count, child: Container(height: 10, color: color));

    final header = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(group.label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary)),
            ),
            const SizedBox(width: 8),
            Container(
              key: Key('position-${group.organeRef}'),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: positionColor(group.position).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(group.positionLabel,
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: positionColor(group.position))),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(5),
          child: total == 0
              ? Container(height: 10, color: AppColors.backgroundSecondary)
              : Row(children: [
                  segment(group.pour, _pourColor),
                  segment(group.contre, _contreColor),
                  segment(group.abstention, _abstColor),
                ]),
        ),
        const SizedBox(height: 4),
        Text(
          '${group.pour} pour · ${group.contre} contre · ${group.abstention} abst.'
          '${group.nonVotants > 0 ? ' · ${group.nonVotants} non-votant(s)' : ''}',
          style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
        ),
      ],
    );

    if (group.dissidents.isEmpty) {
      return Padding(
          padding: const EdgeInsets.symmetric(vertical: 8), child: header);
    }

    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        key: Key('dissidents-${group.organeRef}'),
        tilePadding: EdgeInsets.zero,
        childrenPadding: const EdgeInsets.only(bottom: 8),
        title: header,
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            '${group.dissidents.length} député(s) ont voté différemment du groupe',
            style: const TextStyle(
                fontSize: 11,
                color: AppColors.primaryBlue,
                fontWeight: FontWeight.w600),
          ),
        ),
        children: group.dissidents
            .map((d) => Align(
                  alignment: Alignment.centerLeft,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Text('• ${d.fullName} — ${d.choiceLabel}',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.textPrimary)),
                  ),
                ))
            .toList(),
      ),
    );
  }
}
