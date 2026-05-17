import 'package:flutter/material.dart';
import '../services/report_service.dart';
import '../theme/app_colors.dart';

class ReportErrorDialog extends StatefulWidget {
  final String lawId;

  const ReportErrorDialog({super.key, required this.lawId});

  @override
  State<ReportErrorDialog> createState() => _ReportErrorDialogState();
}

class _ReportErrorDialogState extends State<ReportErrorDialog> {
  String _selectedCategory = 'OTHER';
  final TextEditingController _descriptionController = TextEditingController();
  bool _isSubmitting = false;

  final Map<String, String> _categories = {
    'TITLE': 'Titre de la loi',
    'RESULT': 'Résultats du vote',
    'SUMMARY': 'Résumé Démok',
    'ARGUMENT': 'Arguments (Pour/Contre)',
    'OTHER': 'Autre (précisez)',
  };

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_descriptionController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez décrire l\'erreur')),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    final success = await ReportService.submitReport(
      widget.lawId,
      _selectedCategory,
      _descriptionController.text.trim(),
    );

    if (mounted) {
      setState(() {
        _isSubmitting = false;
      });

      Navigator.of(context).pop(success);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Row(
        children: const [
          Icon(Icons.report_problem_outlined, color: Colors.orange),
          SizedBox(width: 8),
          Expanded(child: Text('Signaler une erreur', style: TextStyle(fontSize: 18))),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Merci de nous aider à garder Démok exact et fiable !',
              style: TextStyle(fontSize: 14, color: Colors.grey),
            ),
            const SizedBox(height: 16),
            const Text('Où se trouve l\'erreur ?', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _selectedCategory,
              isExpanded: true,
              decoration: InputDecoration(
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
              items: _categories.entries.map((e) {
                return DropdownMenuItem(
                  value: e.key,
                  child: Text(e.value),
                );
              }).toList(),
              onChanged: (value) {
                if (value != null) {
                  setState(() {
                    _selectedCategory = value;
                  });
                }
              },
            ),
            const SizedBox(height: 16),
            const Text('Description détaillée', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            TextField(
              controller: _descriptionController,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Expliquez l\'erreur avec le plus de détails possible (vraies valeurs, liens officiels, etc.).',
                hintStyle: const TextStyle(fontSize: 13, color: Colors.grey),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(false),
          child: const Text('Annuler', style: TextStyle(color: Colors.grey)),
        ),
        ElevatedButton(
          onPressed: _isSubmitting ? null : _submit,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primaryBlue,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: _isSubmitting
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                )
              : const Text('Envoyer', style: TextStyle(color: Colors.white)),
        ),
      ],
    );
  }
}
