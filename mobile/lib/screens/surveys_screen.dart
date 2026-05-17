import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:flutter_svg/flutter_svg.dart';
import '../models/candidate.dart';
import '../services/user_session.dart';
import '../theme/app_colors.dart';
import '../services/api_client.dart';
import 'package:showcaseview/showcaseview.dart';

class SurveysScreen extends StatefulWidget {
  const SurveysScreen({Key? key}) : super(key: key);

  @override
  State<SurveysScreen> createState() => _SurveysScreenState();
}

class _SurveysScreenState extends State<SurveysScreen> {
  List<Candidate> _candidates = [];
  bool _loading = true;
  bool _hasVoted = false;
  Map<String, dynamic>? _results;
  String? _error;
  final GlobalKey _presidentialKey = GlobalKey();
  final GlobalKey _candidatesKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _loadData().then((_) {
      if (!UserSession().hasSeenSurveysShowcase) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          Future.delayed(const Duration(milliseconds: 500), () {
            if (mounted) {
              ShowCaseWidget.of(context).startShowCase([
                _presidentialKey,
                _candidatesKey,
              ]);
              UserSession().setSurveysShowcaseSeen();
            }
          });
        });
      }
    });
  }

  Future<void> _loadData() async {
    await _checkVotingStatus();
    await _loadCandidates();
    
    if (_hasVoted) {
      await _loadResults();
    }
  }

  Future<void> _checkVotingStatus() async {
    try {
      final response = await ApiClient.get(
        '/surveys/presidential/has-voted',
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _hasVoted = data['hasVoted'] ?? false;
        });
      }
    } catch (e) {
      print('Error checking vote status: $e');
    }
  }

  Future<void> _loadCandidates() async {
    try {
      final response = await ApiClient.get('/surveys/presidential/candidates');

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        setState(() {
          _candidates = data.map((json) => Candidate.fromJson(json)).toList();
          // Tri sur le NOM (tout ce qui suit le premier mot)
          _candidates.sort((a, b) {
            String partA = a.name.trim().contains(' ') ? a.name.trim().split(' ').sublist(1).join(' ').toLowerCase() : a.name.toLowerCase();
            String partB = b.name.trim().contains(' ') ? b.name.trim().split(' ').sublist(1).join(' ').toLowerCase() : b.name.toLowerCase();
            return partA.compareTo(partB);
          });
          _loading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Erreur de chargement des candidats';
        _loading = false;
      });
    }
  }

  Future<void> _loadResults() async {
    try {
      final response = await ApiClient.get('/surveys/presidential/results');

      if (response.statusCode == 200) {
        setState(() {
          _results = jsonDecode(response.body);
        });
      }
    } catch (e) {
      print('Error loading results: $e');
    }
  }

  Future<void> _vote(String candidateId) async {
    // Optimistic UI: Update UI immediately
    setState(() {
      _hasVoted = true;
      _results = null;
    });

    try {
      final response = await ApiClient.post(
        '/surveys/presidential/vote',
        body: {'candidateId': candidateId},
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final results = jsonDecode(response.body);
        setState(() {
          _results = results;
        });
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Vote enregistré !'),
              backgroundColor: AppColors.primaryBlue,
            ),
          );
        }
      } else {
        throw Exception('Erreur lors du vote');
      }
    } catch (e) {
      if (mounted) {
        // Revert on failure
        setState(() {
          _hasVoted = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur: \${e.toString()}'),
            backgroundColor: AppColors.voteContre,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ShowCaseWidget(
      builder: (context) => Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          automaticallyImplyLeading: true,
          title: const Text(
            'Sondage Présidentielle 2027',
            style: TextStyle(
              color: Colors.black,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!))
                : _buildContent(),
      ),
    );
  }

  Widget _buildContent() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section présidentielle (toujours en premier)
          if (_hasVoted && _results != null)
            _buildResultsInline()
          else if (_hasVoted && _results == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48.0),
              child: Center(
                child: Column(
                  children: [
                    CircularProgressIndicator(),
                    SizedBox(height: 16),
                    Text("Enregistrement de votre vote..."),
                  ],
                ),
              ),
            )
          else
            _buildVotingInterface(),
        ],
      ),
    );
  }

  Widget _buildVotingInterface() {
    return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Showcase(
            key: _presidentialKey,
            description: "Participez au grand sondage national pour la présidentielle 2027. Votre vote est anonyme et modifiable.",
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.primaryBlue.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                children: [
                  Icon(Icons.how_to_vote, color: AppColors.primaryBlue),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Votez pour votre candidat préféré à la présidentielle 2027.\nLes candidats sont classés par ordre alphabétique.',
                      style: TextStyle(
                        fontSize: 14,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          // --- PRÉSIDENTIELLE 2027 (toujours en premier) ---
          const Text('Présidentielle 2027', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 16),
          // Horizontal scrollable row of candidates
          // Grid display of candidates
          Showcase(
            key: _candidatesKey,
            description: "Cliquez sur un candidat pour voir son parti et confirmer votre intention de vote.",
            child: LayoutBuilder(
              builder: (context, constraints) {
                int crossAxisCount = 2;
                if (constraints.maxWidth > 1400) {
                  crossAxisCount = 6;
                } else if (constraints.maxWidth > 1000) {
                  crossAxisCount = 4;
                } else if (constraints.maxWidth > 600) {
                  crossAxisCount = 3;
                }
                
                return GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: crossAxisCount,
                    childAspectRatio: constraints.maxWidth > 600 ? 1.1 : 1.0,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: _candidates.length,
                  itemBuilder: (context, index) {
                    return _buildCandidateCard(_candidates[index]);
                  },
                );
              },
            ),
          ),
        ],
    );
  }

  Widget _buildCandidateCard(Candidate candidate) {
    return Card(
      elevation: 3,
      shadowColor: Colors.black.withValues(alpha: 0.1),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        onTap: () => _showVoteConfirmation(candidate),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Expanded(
                child: Center(
                  child: candidate.logoPath == null
                      ? const Icon(Icons.account_balance, size: 48, color: AppColors.primaryBlue)
                      : (candidate.isNetworkLogo
                          ? (candidate.isSvgLogo
                              ? SvgPicture.network(
                                  candidate.logoPath!,
                                  width: 60,
                                  height: 60,
                                  placeholderBuilder: (context) => const SizedBox(
                                    width: 60,
                                    height: 60,
                                    child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                                  ),
                                )
                              : Image.network(
                                  candidate.logoPath!,
                                  width: 60,
                                  height: 60,
                                  fit: BoxFit.contain,
                                  errorBuilder: (context, error, stackTrace) =>
                                      const Icon(Icons.error, color: Colors.red, size: 30),
                                ))
                          : (candidate.isSvgLogo
                              ? SvgPicture.asset(
                                  candidate.logoPath!,
                                  width: 60,
                                  height: 60,
                                )
                              : Image.asset(
                                  candidate.logoPath!,
                                  width: 60,
                                  height: 60,
                                  fit: BoxFit.contain,
                                ))),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                candidate.name,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  height: 1.2,
                ),
              ),
              if (candidate.party.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  candidate.party,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[700],
                    fontWeight: FontWeight.w500,
                    height: 1.2,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _showVoteConfirmation(Candidate candidate) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Confirmer votre vote'),
          content: Text(
            'Voulez-vous voter pour ${candidate.name} (${candidate.party}) ?\n\nVous ne pourrez voter qu\'une seule fois.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Annuler'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
                _vote(candidate.id);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryBlue,
                foregroundColor: Colors.white,
              ),
              child: const Text('Confirmer'),
            ),
          ],
        );
      },
    );
  }

  Widget _buildResultsInline() {
    final results = _results!['results'] as List<dynamic>;

    // Tri sur le NOM (tout ce qui suit le premier mot)
    results.sort((a, b) {
      String nameA = a['name'] as String;
      String nameB = b['name'] as String;
      String partA = nameA.trim().contains(' ') ? nameA.trim().split(' ').sublist(1).join(' ').toLowerCase() : nameA.toLowerCase();
      String partB = nameB.trim().contains(' ') ? nameB.trim().split(' ').sublist(1).join(' ').toLowerCase() : nameB.toLowerCase();
      return partA.compareTo(partB);
    });

    return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primaryBlue.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                const Icon(Icons.poll, color: AppColors.primaryBlue),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Candidats classés par ordre alphabétique',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Bouton Modifier mon vote
          Center(
            child: TextButton.icon(
              onPressed: () {
                setState(() {
                  _hasVoted = false;
                  _results = null;
                });
              },
              icon: const Icon(Icons.edit, size: 18),
              label: const Text('Modifier mon vote'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.primaryBlue,
                textStyle: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Grid display of results
          LayoutBuilder(
            builder: (context, constraints) {
              int crossAxisCount = 2;
              if (constraints.maxWidth > 1400) {
                crossAxisCount = 6;
              } else if (constraints.maxWidth > 1000) {
                crossAxisCount = 4;
              } else if (constraints.maxWidth > 600) {
                crossAxisCount = 3;
              }

              return GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: crossAxisCount,
                  childAspectRatio: constraints.maxWidth > 600 ? 1.2 : 0.85,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                ),
                itemCount: results.length,
                itemBuilder: (context, index) {
                  return _buildResultCard(results[index]);
                },
              );
            },
          ),

        ],
    );
  }

  Widget _buildResultCard(Map<String, dynamic> result) {
    final percentage = (result['percentage'] as num).toDouble();
    // Create a temporary candidate object to reuse logoPath logic
    final candidate = Candidate(
      id: result['candidateId'] ?? '',
      name: result['name'],
      party: result['party'],
      photoUrl: result['photoUrl'],
    );

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
             // Petit Logo en haut des résultats
             if (candidate.logoPath != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8.0),
                  child: candidate.isNetworkLogo
                      ? (candidate.isSvgLogo
                          ? SvgPicture.network(
                              candidate.logoPath!,
                              height: 30,
                              fit: BoxFit.contain,
                            )
                          : Image.network(
                              candidate.logoPath!,
                              height: 30,
                              fit: BoxFit.contain,
                            ))
                      : (candidate.isSvgLogo
                          ? SvgPicture.asset(
                              candidate.logoPath!,
                              height: 30,
                              fit: BoxFit.contain,
                            )
                          : Image.asset(
                              candidate.logoPath!,
                              height: 30,
                              fit: BoxFit.contain,
                            )),
                ),
            Text(
              result['name'],
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '${percentage.toStringAsFixed(1)}%',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppColors.primaryBlue,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
