import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/candidate_position.dart';
import '../services/law_service.dart';
import '../theme/app_colors.dart';

Color lawPositionColor(String position) => switch (position) {
      'POUR' => const Color(0xFF15803D),
      'CONTRE' => const Color(0xFFB91C1C),
      'ABSTENTION' => const Color(0xFF64748B),
      'NUANCE' => AppColors.warning,
      _ => AppColors.textTertiary,
    };

Future<void> _openSource(String url) async {
  final uri = Uri.parse(url);
  if (await canLaunchUrl(uri))
    await launchUrl(uri, mode: LaunchMode.externalApplication);
}

String _date(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

class PositionChip extends StatelessWidget {
  final String position;
  const PositionChip(this.position, {super.key});

  @override
  Widget build(BuildContext context) {
    final color = lawPositionColor(position);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(10)),
      child: Text(CandidatePosition.labelOf(position),
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.bold, color: color)),
    );
  }
}

/// Origine de la position : type de source, citation, date, lien et rappel du vote du groupe.
class PositionSource extends StatelessWidget {
  final CandidatePosition position;
  final Future<void> Function(String url) openSource;

  const PositionSource(
      {super.key, required this.position, this.openSource = _openSource});

  @override
  Widget build(BuildContext context) {
    final p = position;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          p.sourceLabel +
              (p.sourceDate != null ? ' · ${_date(p.sourceDate!)}' : ''),
          style: TextStyle(
            fontSize: 11,
            color: p.isGroupProxy ? AppColors.warning : AppColors.textSecondary,
            fontStyle: p.isGroupProxy ? FontStyle.italic : FontStyle.normal,
          ),
        ),
        if (p.quote != null && p.quote!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text('« ${p.quote} »',
                style:
                    const TextStyle(fontSize: 12, fontStyle: FontStyle.italic)),
          ),
        if (p.groupPosition != null && p.groupLabel != null)
          Text(
              'Son groupe (${p.groupLabel}) : ${CandidatePosition.labelOf(p.groupPosition!)}',
              style:
                  const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
        if (p.sourceUrl != null)
          InkWell(
            onTap: () => openSource(p.sourceUrl!),
            child: const Padding(
              padding: EdgeInsets.only(top: 2),
              child: Text('Voir la source',
                  style: TextStyle(
                      fontSize: 11,
                      color: AppColors.primaryBlue,
                      decoration: TextDecoration.underline)),
            ),
          ),
      ],
    );
  }
}

const _disclaimer =
    'Positions sourcées : vote de député, déclaration publique ou programme. Le vote d\'un groupe '
    'est indiqué comme tel et ne vaut pas position personnelle. Aucune position n\'est générée par IA.';

/// Fiche loi : « Ce qu'en disent les candidats à la présidentielle ».
class CandidatePositionsSection extends StatefulWidget {
  final String lawId;
  final Future<List<CandidateOnLaw>> Function(String lawId) loader;

  const CandidatePositionsSection(
      {super.key,
      required this.lawId,
      this.loader = LawService.fetchCandidatePositions});

  @override
  State<CandidatePositionsSection> createState() =>
      _CandidatePositionsSectionState();
}

class _CandidatePositionsSectionState extends State<CandidatePositionsSection> {
  late Future<List<CandidateOnLaw>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.loader(widget.lawId).catchError((_) => <CandidateOnLaw>[]);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<CandidateOnLaw>>(
      future: _future,
      builder: (context, snapshot) {
        final all = snapshot.data ?? const <CandidateOnLaw>[];
        final known = all.where((c) => c.position.isKnown).toList();
        if (snapshot.connectionState != ConnectionState.done || known.isEmpty)
          return const SizedBox.shrink();
        final unknown = all.length - known.length;

        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Material(
            color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: AppColors.cardBorder),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                      'Ce qu\'en disent les candidats à la présidentielle',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary)),
                  const SizedBox(height: 4),
                  const Text(_disclaimer,
                      style: TextStyle(
                          fontSize: 11, color: AppColors.textSecondary)),
                  const SizedBox(height: 8),
                  ...known.map((c) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(c.name,
                                      style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600)),
                                  Text(c.party,
                                      style: const TextStyle(
                                          fontSize: 11,
                                          color: AppColors.textSecondary)),
                                  const SizedBox(height: 2),
                                  PositionSource(position: c.position),
                                ],
                              ),
                            ),
                            PositionChip(c.position.position),
                          ],
                        ),
                      )),
                  if (unknown > 0)
                    Text(
                        '$unknown candidat(s) sans position connue sur ce texte',
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.textTertiary)),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Fiche candidat : « Ses positions sur les lois », filtrables par thème.
class CandidateLawPositionsList extends StatefulWidget {
  final String candidateId;
  final Future<List<LawOfCandidate>> Function(String candidateId) loader;

  const CandidateLawPositionsList(
      {super.key,
      required this.candidateId,
      this.loader = LawService.fetchPositionsOfCandidate});

  @override
  State<CandidateLawPositionsList> createState() =>
      _CandidateLawPositionsListState();
}

class _CandidateLawPositionsListState extends State<CandidateLawPositionsList> {
  late Future<List<LawOfCandidate>> _future;
  String? _category;

  @override
  void initState() {
    super.initState();
    _future =
        widget.loader(widget.candidateId).catchError((_) => <LawOfCandidate>[]);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<LawOfCandidate>>(
      future: _future,
      builder: (context, snapshot) {
        final items = (snapshot.data ?? const <LawOfCandidate>[])
            .where((i) => i.position.isKnown)
            .toList();
        if (snapshot.connectionState != ConnectionState.done || items.isEmpty)
          return const SizedBox.shrink();

        final categories = <String, String>{};
        for (final item in items) {
          for (final c in item.categories) {
            categories[c.slug] = '${c.icon} ${c.name}'.trim();
          }
        }
        final visible = _category == null
            ? items
            : items
                .where((i) => i.categories.any((c) => c.slug == _category))
                .toList();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 16),
            const Text('Ses positions sur les lois',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 4),
            const Text(_disclaimer,
                style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            if (categories.length > 1)
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(children: [
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: const Text('Tous'),
                      selected: _category == null,
                      onSelected: (_) => setState(() => _category = null),
                    ),
                  ),
                  ...categories.entries.map((e) => Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          key: Key('category-${e.key}'),
                          label: Text(e.value),
                          selected: _category == e.key,
                          onSelected: (_) => setState(() => _category = e.key),
                        ),
                      )),
                ]),
              ),
            ...visible.map((i) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(i.title,
                                style: const TextStyle(
                                    fontSize: 13, fontWeight: FontWeight.w600)),
                            PositionSource(position: i.position),
                          ],
                        ),
                      ),
                      PositionChip(i.position.position),
                    ],
                  ),
                )),
          ],
        );
      },
    );
  }
}
