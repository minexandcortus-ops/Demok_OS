import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/candidate.dart';
import '../theme/app_colors.dart';

typedef LinkOpener = Future<void> Function(Uri uri);

Future<void> _defaultOpener(Uri uri) async {
  if (await canLaunchUrl(uri)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

String _formatDate(DateTime date) {
  final d = date.toLocal();
  return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
}

/// Liens d'un candidat, du plus officiel au moins officiel :
/// statut de candidature, programme officiel (ou son état), site de campagne,
/// puis la fiche de synthèse tierce, clairement identifiée par son domaine.
class CandidateLinks extends StatelessWidget {
  final Candidate candidate;
  final LinkOpener openLink;

  const CandidateLinks({super.key, required this.candidate, this.openLink = _defaultOpener});

  void _open(String url) => openLink(Uri.parse(Candidate.resolveLink(url)));

  @override
  Widget build(BuildContext context) {
    final children = <Widget>[];

    final statusLabel = candidate.statusLabel;
    if (statusLabel != null) {
      final retired = candidate.status == 'RETIRE';
      children.add(Align(
        alignment: Alignment.center,
        child: Chip(
          key: const Key('candidate-status'),
          label: Text(statusLabel),
          avatar: Icon(retired ? Icons.block : Icons.verified, size: 16,
              color: retired ? AppColors.textSecondary : AppColors.success),
          backgroundColor: retired ? AppColors.backgroundSecondary : AppColors.success.withValues(alpha: 0.1),
          side: BorderSide.none,
        ),
      ));
      children.add(const SizedBox(height: 12));
    }

    if (candidate.hasOfficialProgram) {
      children.add(SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          key: const Key('official-program'),
          onPressed: () => _open(candidate.officialProgramUrl!),
          icon: const Icon(Icons.description_outlined, size: 20),
          label: Text(candidate.programStatus == 'PARTIEL' ? 'Programme officiel (partiel)' : 'Programme officiel'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.darkBlue,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        ),
      ));
      if (candidate.programPublishedAt != null) {
        children.add(Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text('Publié le ${_formatDate(candidate.programPublishedAt!)}',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        ));
      }
    } else {
      children.add(Container(
        key: const Key('program-status'),
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
        decoration: BoxDecoration(
          color: AppColors.backgroundSecondary,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.hourglass_empty, size: 16, color: AppColors.textSecondary),
            const SizedBox(width: 6),
            Text(candidate.programStatusLabel, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          ],
        ),
      ));
    }

    if (candidate.officialSiteUrl != null) {
      children.add(const SizedBox(height: 8));
      children.add(SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          key: const Key('official-site'),
          onPressed: () => _open(candidate.officialSiteUrl!),
          icon: const Icon(Icons.public, size: 20),
          label: const Text('Site de campagne'),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.primaryBlue,
            side: const BorderSide(color: AppColors.primaryBlue),
            padding: const EdgeInsets.symmetric(vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        ),
      ));
    }

    final host = candidate.summarySourceHost;
    if (host != null) {
      children.add(const SizedBox(height: 4));
      children.add(TextButton.icon(
        key: const Key('summary-source'),
        onPressed: () => _open(candidate.programUrl!),
        icon: const Icon(Icons.open_in_new, size: 16),
        label: Text('Fiche de synthèse · $host', style: const TextStyle(fontSize: 13)),
      ));
    }

    if (candidate.linksCheckedAt != null) {
      children.add(Text(
        'Liens officiels vérifiés le ${_formatDate(candidate.linksCheckedAt!)}',
        key: const Key('links-checked'),
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 11, color: AppColors.textTertiary),
      ));
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
  }
}
