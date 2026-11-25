import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:flutter_svg/flutter_svg.dart';
import '../models/candidate.dart';
import '../data/political_street_data.dart';
import '../services/user_session.dart';
import '../theme/app_colors.dart';
import '../services/api_client.dart';
import '../widgets/auth_prompt_modal.dart';
import '../widgets/candidate_links.dart';

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
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _loadData().then((_) {
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
    if (UserSession().isGuest) return;
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
    if (UserSession().isGuest) {
      AuthPromptModal.show(
        context,
        title: 'Votez pour la Présidentielle 2027',
        message: 'Créez un compte citoyen en quelques secondes pour voter anonymement et découvrir les résultats de la communauté.',
      );
      return;
    }
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
    return Scaffold(
      backgroundColor: Colors.white,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : _buildContent(),
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
          Container(
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
          const SizedBox(height: 20),
          // --- PRÉSIDENTIELLE 2027 (toujours en premier) ---
          const Text('Présidentielle 2027', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 16),
          // Barre de recherche
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Rechercher un candidat...',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppColors.primaryBlue),
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
            ),
            onChanged: (value) {
              setState(() {
                _searchQuery = value.toLowerCase();
              });
            },
          ),
          const SizedBox(height: 16),
          // Horizontal scrollable row of candidates
          // Grid display of candidates
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
                
                final filteredCandidates = _candidates.where((c) {
                  final matchesName = c.name.toLowerCase().contains(_searchQuery);
                  final matchesParty = c.party.toLowerCase().contains(_searchQuery);
                  return matchesName || matchesParty;
                }).toList();

                if (filteredCandidates.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.all(32.0),
                    child: Center(child: Text("Aucun candidat trouvé pour cette recherche.")),
                  );
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
                  itemCount: filteredCandidates.length,
                  itemBuilder: (context, index) {
                    return _buildCandidateCard(filteredCandidates[index]);
                  },
                );
              },
            ),
        ],
    );
  }

  Widget _buildCandidateListLogo(Candidate candidate, {double size = 60}) {
    final logo = candidate.logoPath;
    if (logo != null) {
      if (candidate.isNetworkLogo) {
        return candidate.isSvgLogo
            ? SvgPicture.network(
                logo,
                width: size,
                height: size,
                fit: BoxFit.contain,
                placeholderBuilder: (context) => SizedBox(
                  width: size,
                  height: size,
                  child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                ),
              )
            : Image.network(
                logo,
                width: size,
                height: size,
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) => SvgPicture.asset(
                  Candidate.sansEtiquetteLogoPath,
                  width: size,
                  height: size,
                  fit: BoxFit.contain,
                ),
              );
      } else {
        return candidate.isSvgLogo
            ? SvgPicture.asset(
                logo,
                width: size,
                height: size,
                fit: BoxFit.contain,
              )
            : Image.asset(
                logo,
                width: size,
                height: size,
                fit: BoxFit.contain,
              );
      }
    }

    // Aucun logo de parti ou sans parti :
    // Afficher la petite image / badge "Sans étiquette" au lieu de la photo.
    // La photo n'apparaît que quand on ouvre la fiche du candidat !
    return SvgPicture.asset(
      Candidate.sansEtiquetteLogoPath,
      width: size,
      height: size,
      fit: BoxFit.contain,
    );
  }

  Widget _buildCandidateCard(Candidate candidate) {
    return Card(
      elevation: 3,
      shadowColor: Colors.black.withValues(alpha: 0.1),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        onTap: () => _showCandidateDetail(candidate),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Expanded(
                child: Center(
                  child: _buildCandidateListLogo(candidate, size: 60),
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

  void _showCandidateDetail(Candidate candidate) {
    bool isStreet = UserSession().isStreetModePreferred;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (BuildContext context, StateSetter setModalState) {
            final displaySummary = PoliticalStreetData.getCandidateSummary(
              candidate.name,
              streetMode: isStreet,
              defaultDescription: candidate.description,
            );

            final partyBio = PoliticalStreetData.getPartyBio(
              candidate.party,
              streetMode: isStreet,
            );

            final keyMeasures = PoliticalStreetData.getCandidateKeyMeasures(
              candidate.name,
              streetMode: isStreet,
            );

            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.9,
              ),
              padding: const EdgeInsets.only(top: 24, left: 24, right: 24, bottom: 32),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(24),
                  topRight: Radius.circular(24),
                ),
              ),
              child: SafeArea(
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Poignée du modal
                      Container(
                        width: 40,
                        height: 4,
                        margin: const EdgeInsets.only(bottom: 20),
                        decoration: BoxDecoration(
                          color: Colors.grey[300],
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),

                      // Photo officielle du candidat
                      if (candidate.fullPhotoUrl != null)
                        ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: Image.network(
                            candidate.fullPhotoUrl!,
                            height: 120,
                            width: 100,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) =>
                                const Icon(Icons.account_circle, size: 80, color: Colors.grey),
                          ),
                        )
                      else
                        const Icon(Icons.account_circle, size: 80, color: Colors.grey),
                      const SizedBox(height: 16),

                      // Nom et parti
                      Text(
                        candidate.name,
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        candidate.party,
                        style: TextStyle(fontSize: 16, color: Colors.grey[600], fontWeight: FontWeight.w500),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 18),

                      // Toggle Classique / Mode Rue
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.grey[100],
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: Colors.grey.shade300),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            GestureDetector(
                              onTap: () => setModalState(() => isStreet = false),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                decoration: BoxDecoration(
                                  color: !isStreet ? AppColors.primaryBlue : Colors.transparent,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  '🏛️ Classique',
                                  style: TextStyle(
                                    color: !isStreet ? Colors.white : Colors.grey[700],
                                    fontWeight: !isStreet ? FontWeight.bold : FontWeight.w500,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            ),
                            GestureDetector(
                              onTap: () => setModalState(() => isStreet = true),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                decoration: BoxDecoration(
                                  color: isStreet ? const Color(0xFFEA580C) : Colors.transparent,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  '🔥 Mode Rue',
                                  style: TextStyle(
                                    color: isStreet ? Colors.white : Colors.grey[700],
                                    fontWeight: isStreet ? FontWeight.bold : FontWeight.w500,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Résumé du profil (Classique ou Mode Rue)
                      if (displaySummary.isNotEmpty) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: isStreet ? const Color(0xFFFFF7ED) : Colors.grey[50],
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isStreet ? const Color(0xFFFDBA74) : Colors.grey.shade200,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    PoliticalStreetData.getCandidateProfileTitle(candidate.name, streetMode: isStreet),
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                      color: isStreet ? const Color(0xFFEA580C) : AppColors.primaryBlue,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                displaySummary,
                                style: const TextStyle(fontSize: 14, height: 1.5, color: Colors.black87),
                                textAlign: TextAlign.left,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          "Généré par Mistral AI",
                          style: const TextStyle(
                            fontStyle: FontStyle.italic,
                            color: Colors.grey,
                            fontSize: 11,
                          ),
                        ),
                      ],

                      // Courte biographie du parti
                      if (partyBio != null && partyBio.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: isStreet ? const Color(0xFFFFFBEB) : const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isStreet ? const Color(0xFFFDE68A) : Colors.grey.shade300,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  // Petit logo du parti si disponible
                                  if (candidate.logoPath != null)
                                    Padding(
                                      padding: const EdgeInsets.only(right: 8.0),
                                      child: candidate.isNetworkLogo
                                          ? (candidate.isSvgLogo
                                              ? SvgPicture.network(candidate.logoPath!, height: 20)
                                              : Image.network(candidate.logoPath!, height: 20))
                                          : (candidate.isSvgLogo
                                              ? SvgPicture.asset(candidate.logoPath!, height: 20)
                                              : Image.asset(candidate.logoPath!, height: 20)),
                                    ),
                                  Expanded(
                                    child: Text(
                                      isStreet ? 'Le bail du parti :' : 'À propos du parti :',
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                        color: isStreet ? const Color(0xFFD97706) : Colors.grey[800],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                partyBio,
                                style: TextStyle(fontSize: 13, height: 1.4, color: Colors.grey[800]),
                              ),
                            ],
                          ),
                        ),
                      ],

                      if (keyMeasures.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Container(
                          decoration: BoxDecoration(
                            color: isStreet ? const Color(0xFFFFFBEB) : Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isStreet ? const Color(0xFFFDE68A) : AppColors.cardBorderSubtle,
                              width: 1.2,
                            ),
                            boxShadow: isStreet ? null : AppColors.cardShadow,
                          ),
                          child: Theme(
                            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                            child: ExpansionTile(
                              initiallyExpanded: false,
                              shape: const Border(),
                              collapsedShape: const Border(),
                              tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                              childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                              iconColor: isStreet ? const Color(0xFFD97706) : AppColors.primaryBlue,
                              collapsedIconColor: isStreet ? const Color(0xFFD97706) : AppColors.primaryBlue,
                              title: Text(
                                PoliticalStreetData.getKeyMeasuresTitle(streetMode: isStreet),
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: isStreet ? const Color(0xFF92400E) : AppColors.darkBlue,
                                ),
                              ),
                              children: keyMeasures.map((measure) {
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '• ',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.bold,
                                          color: isStreet ? const Color(0xFFD97706) : AppColors.primaryBlue,
                                        ),
                                      ),
                                      Expanded(
                                        child: Text(
                                          measure,
                                          style: TextStyle(
                                            fontSize: 13,
                                            height: 1.4,
                                            color: isStreet ? const Color(0xFF78350F) : AppColors.textPrimary,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                        ),
                      ],

                      const SizedBox(height: 20),

                      // Programme officiel, site de campagne et fiche de synthèse
                      CandidateLinks(candidate: candidate),

                      const SizedBox(height: 16),

                      // Bouton de Vote (ouvre la modale de création de compte pour les invités)
                      if (!_hasVoted)
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: UserSession().isGuest
                                ? () {
                                    Navigator.pop(context);
                                    AuthPromptModal.show(
                                      this.context,
                                      title: 'Votez pour la Présidentielle 2027',
                                      message:
                                          'Créez un compte citoyen en quelques secondes pour voter anonymement pour ${candidate.name} et découvrir les résultats de la communauté.',
                                    );
                                  }
                                : () {
                                    Navigator.pop(context);
                                    _showVoteConfirmation(candidate);
                                  },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primaryBlue,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            child: const Text(
                              "Voter pour ce profil",
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
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

    // Filter results based on search query
    final filteredResults = results.where((r) {
      final name = r['name'] as String? ?? '';
      final party = r['party'] as String? ?? '';
      final matchesName = name.toLowerCase().contains(_searchQuery);
      final matchesParty = party.toLowerCase().contains(_searchQuery);
      return matchesName || matchesParty;
    }).toList();

    // Tri sur le NOM (tout ce qui suit le premier mot)
    filteredResults.sort((a, b) {
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
          // Barre de recherche
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Rechercher un candidat...',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppColors.primaryBlue),
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
            ),
            onChanged: (value) {
              setState(() {
                _searchQuery = value.toLowerCase();
              });
            },
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
              
              if (filteredResults.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.all(32.0),
                  child: Center(child: Text("Aucun candidat trouvé pour cette recherche.")),
                );
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
                itemCount: filteredResults.length,
                itemBuilder: (context, index) {
                  return _buildResultCard(filteredResults[index]);
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
    final candidate = Candidate.fromJson({...result, 'id': result['candidateId'] ?? ''});

    return InkWell(
      onTap: () => _showCandidateDetail(candidate),
      borderRadius: BorderRadius.circular(12),
      child: Card(
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
               // Logo du parti (ou Sans étiquette si pas de parti)
               Padding(
                 padding: const EdgeInsets.only(bottom: 8.0),
                 child: _buildCandidateListLogo(candidate, size: 30),
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
      ),
    );
  }
}
