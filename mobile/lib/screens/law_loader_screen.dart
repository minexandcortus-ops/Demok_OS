import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/law.dart';
import '../services/api_client.dart';
import 'law_detail_screen.dart';

class LawLoaderScreen extends StatefulWidget {
  final String lawId;

  const LawLoaderScreen({super.key, required this.lawId});

  @override
  State<LawLoaderScreen> createState() => _LawLoaderScreenState();
}

class _LawLoaderScreenState extends State<LawLoaderScreen> {
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchLawAndNavigate();
  }

  Future<void> _fetchLawAndNavigate() async {
    try {
      final response = await ApiClient.get('/votes/laws/${widget.lawId}');
      if (response.statusCode == 200) {
        final Map<String, dynamic> data = jsonDecode(response.body);
        final law = Law.fromJson(data);
        
        if (mounted) {
          // Remplacer l'écran de chargement par le détail de la loi
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => LawDetailScreen(law: law),
            ),
          );
        }
      } else {
        if (mounted) {
          setState(() {
            _isLoading = false;
            _errorMessage = 'Impossible de charger cette loi.';
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Erreur réseau.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Chargement...'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      body: Center(
        child: _isLoading
            ? const CircularProgressIndicator()
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.red),
                  const SizedBox(height: 16),
                  Text(
                    _errorMessage ?? 'Erreur inconnue',
                    style: const TextStyle(fontSize: 16),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Retour'),
                  ),
                ],
              ),
      ),
    );
  }
}
