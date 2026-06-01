import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:convert';
import '../theme/app_colors.dart';
import '../services/user_session.dart';
import '../models/law.dart';
import '../widgets/law_card.dart';
import '../widgets/skeleton_law_card.dart';
import '../widgets/government_modal.dart';
import 'law_detail_screen.dart';
import 'profile_screen.dart';
import 'surveys_screen.dart';
import 'debate_detail_screen.dart';
import '../widgets/debate_card.dart';
import '../widgets/survey_card.dart';
import '../widgets/topic_poll_card.dart';
import '../services/api_client.dart';
import '../services/debate_service.dart';
import 'package:showcaseview/showcaseview.dart';
import '../widgets/showcase_helper.dart';
import '../services/pwa_install_service.dart';
import '../widgets/android_install_banner.dart';
import '../widgets/ios_install_banner.dart';
import '../services/push_notification_service.dart';

class HomeScreen extends StatelessWidget {
  final int initialTab;
  const HomeScreen({super.key, this.initialTab = 0});

  @override
  Widget build(BuildContext context) {
    // _HomeScreenContent expose son _schedulePwaBanner via la clé globale
    final contentKey = GlobalKey<_HomeScreenContentState>();
    return DemokShowcaseWidget(
      onFinish: () => UserSession().setHomeShowcaseSeen(),
      onShowcaseFinished: () {
        // Déclenche la bannière PWA 3s après la fin/skip du showcase
        contentKey.currentState?._schedulePwaBanner();
        // Déclenche la popup de notifications 1.5s après la fin/skip du showcase
        contentKey.currentState?._scheduleNotificationPrompt();
      },
      builder: (context) => _HomeScreenContent(key: contentKey, initialTab: initialTab),
    );
  }
}

/// Écran principal de l'application affichant le flux des lois.
/// Gère la recherche, le filtrage par catégorie/région et l'affichage des cartes de lois.
class _HomeScreenContent extends StatefulWidget {
  final int initialTab;
  const _HomeScreenContent({super.key, this.initialTab = 0});

  @override
  State<_HomeScreenContent> createState() => _HomeScreenContentState();
}

class _HomeScreenContentState extends State<_HomeScreenContent> {
  List<Law> _laws = [];
  String? _selectedRegion;
  String? _selectedStatus;
  String _sortBy = 'DESC';
  String _searchQuery = '';
  Timer? _debounce;
  Timer? _pwaBannerTimer;
  bool _isLoading = true;
  late int _selectedTabIndex;
  List<Map<String, dynamic>> _topicPolls = [];
  bool _showPwaBanner = false;

  // Données spécifiques à l'onglet Débats
  List<Law> _activeDebateLaws = [];
  bool _isLoadingDebates = false;

  // Pagination states
  int _currentPage = 1;
  bool _hasMoreLaws = true;
  bool _isLoadingMore = false;
  final ScrollController _lawsScrollController = ScrollController();
  final ScrollController _debatesScrollController = ScrollController();
  double _savedScrollOffset = 0.0;

  final GlobalKey _govKey = GlobalKey();
  final GlobalKey _filterKey = GlobalKey();
  final GlobalKey _searchKey = GlobalKey();
  final GlobalKey _lawKey = GlobalKey();
  final GlobalKey _profileKey = GlobalKey();
  final GlobalKey _surveyTabKey = GlobalKey();
  final GlobalKey _debateTabKey = GlobalKey();
  final GlobalKey _firstDebateKey = GlobalKey();
  bool _showFavoritesOnly = false;
  bool _showVotedOnly = false;

  @override
  void initState() {
    super.initState();
    _selectedTabIndex = widget.initialTab;
    _fetchLaws();
    _fetchTopicPolls();
    _fetchActiveDebates();

    _lawsScrollController.addListener(() {
      if (_lawsScrollController.position.pixels >= _lawsScrollController.position.maxScrollExtent - 200 && !_isLoadingMore && _hasMoreLaws) {
        _loadMoreLaws();
      }
    });

    _debatesScrollController.addListener(() {
      if (_debatesScrollController.position.pixels >= _debatesScrollController.position.maxScrollExtent - 200 && !_isLoadingMore && _hasMoreLaws) {
        _loadMoreLaws();
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!UserSession().hasSeenHomeShowcase && !_isLoading && _laws.isNotEmpty) {
        _checkAndStartShowcase();
      }
    });
  }

  void _scheduleNotificationPrompt() {
    if (!mounted) return;
    if (PwaInstallService().isAlreadyInstalled && 
        !UserSession().isGuest && 
        UserSession().isLoggedIn && 
        !UserSession().hasSeenNotificationPromptAfterInstall) {
      
      Future.delayed(const Duration(milliseconds: 1500), () {
        if (mounted) _showNotificationPromptAfterInstall();
      });
    }
  }

  void _showNotificationPromptAfterInstall() {
    UserSession().setNotificationPromptAfterInstallSeen();
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Restez au courant !', style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text(
          "Activez les notifications pour ne rater aucun sondage ni résultat de vote. Vous pourrez les désactiver à tout moment depuis votre profil.",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Plus tard', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.of(context).pop();
              // Déclenche la demande native du système d'exploitation
              await PushNotificationService().init();
              
              if (context.mounted) {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const ProfileScreen(autoExpandNotifications: true)),
                );
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primaryBlue),
            child: const Text('Activer', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _checkAndStartShowcase() {
    if (!mounted || UserSession().hasSeenHomeShowcase) return;
    
    final keys = [
      _govKey,
      _filterKey,
      _searchKey,
      if (_laws.isNotEmpty) _lawKey,
      _profileKey,
      _surveyTabKey,
      _debateTabKey,
    ];
    
    ShowCaseWidget.of(context).startShowCase(keys);
  }

  /// Planifie l'affichage de la bannière PWA après un délai de 3 secondes.
  /// Ne s'affiche que pour les membres connectés (pas les invités),
  /// que si la PWA n'est pas déjà installée, et que si la fenêtre
  /// de cooldown est écoulée.
  void _schedulePwaBanner() {
    if (!mounted) return;
    if (UserSession().isGuest || !UserSession().isLoggedIn) return;
    if (!UserSession().shouldShowPwaBanner) return;
    final pwa = PwaInstallService();
    if (pwa.isAlreadyInstalled) return;
    if (!pwa.isAndroid && !pwa.isIos) return;

    _pwaBannerTimer?.cancel();
    _pwaBannerTimer = Timer(const Duration(seconds: 3), () {
      if (!mounted) return;
      setState(() => _showPwaBanner = true);
    });
  }

  void _hidePwaBanner() {
    if (!mounted) return;
    setState(() => _showPwaBanner = false);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _pwaBannerTimer?.cancel();
    _lawsScrollController.dispose();
    _debatesScrollController.dispose();
    super.dispose();
  }

  Future<void> _fetchTopicPolls() async {
    try {
      final response = await ApiClient.get('/surveys/polls');
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        setState(() {
          _topicPolls = data.map((e) => e as Map<String, dynamic>).toList();
        });
      }
    } catch (e) {
      debugPrint('Error fetching topic polls: $e');
    }
  }

  Future<void> _fetchActiveDebates() async {
    if (!mounted) return;
    setState(() => _isLoadingDebates = true);
    try {
      final laws = await DebateService.getActiveLaws(limit: 30);
      if (mounted) {
        setState(() {
          _activeDebateLaws = laws;
          _isLoadingDebates = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching active debates: $e');
      if (mounted) setState(() => _isLoadingDebates = false);
    }
  }


  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      setState(() {
        _searchQuery = query;
        _isLoading = true;
      });
      _fetchLaws(refresh: true);
    });
  }

  Future<void> _loadMoreLaws() async {
    if (_isLoadingMore || !_hasMoreLaws) return;
    setState(() {
      _isLoadingMore = true;
      _currentPage++;
    });
    await _fetchLaws(refresh: false);
  }

  /// Récupère la liste des lois depuis le backend en appliquant les filtres actifs.
  /// Inclut les statistiques de vote et le statut de vote de l'utilisateur.
  Future<void> _fetchLaws({bool refresh = true}) async {
    if (refresh) {
      if (!mounted) return;
      _currentPage = 1;
      _hasMoreLaws = true;
      if (!_isLoading) {
        setState(() {
          _isLoading = true;
        });
      }
    }

    try {
      String path = '/votes/laws';
      final queryParameters = <String>[];
      
      if (_selectedRegion != null) {
        queryParameters.add('region=$_selectedRegion');
      }
      if (_selectedStatus != null) {
        queryParameters.add('status=$_selectedStatus');
      }
      if (_showVotedOnly) {
        queryParameters.add('votedOnly=true');
      }
      queryParameters.add('sortBy=$_sortBy');
      if (_searchQuery.isNotEmpty) {
        queryParameters.add('q=${Uri.encodeComponent(_searchQuery)}');
      }
      
      // Pagination parameters
      queryParameters.add('page=$_currentPage');
      queryParameters.add('limit=10');

      if (queryParameters.isNotEmpty) {
        path += '?${queryParameters.join('&')}';
      }

      final response = await ApiClient.get(path, headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        });

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        final newLaws = data.map((json) => Law.fromJson(json)).toList();
        
        setState(() {
          if (refresh) {
            _laws = newLaws;
            _isLoading = false;
          } else {
            _laws.addAll(newLaws);
            _isLoadingMore = false;
          }
          
          if (newLaws.length < 10) {
            _hasMoreLaws = false; // no more items if we received less than the limit
          }
        });
        
        if (refresh && !UserSession().hasSeenHomeShowcase) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _checkAndStartShowcase();
          });
        } else if (refresh && UserSession().hasSeenHomeShowcase) {
          // Showcase déjà vu : planifie la bannière et la popup notifications directement
          _schedulePwaBanner();
          _scheduleNotificationPrompt();
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          if (refresh) _isLoading = false;
          _isLoadingMore = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final displayedLaws = _laws.where((l) {
      if (_showFavoritesOnly && !l.isFavorited) return false;
      if (_showVotedOnly && l.lawStatus == LawStatus.upcoming) return false;
      return true;
    }).toList()
      // Les lois avec "Vote aujourd'hui" remontent systématiquement en tête de feed
      ..sort((a, b) {
        final aToday = a.isVoteToday ? 0 : 1;
        final bToday = b.isVoteToday ? 0 : 1;
        return aToday.compareTo(bToday);
      });


    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        elevation: 0,
        automaticallyImplyLeading: false,
        toolbarHeight: 100, // Increased height for larger logo
        title: Image.asset(
          'assets/images/logo_demok_vf.png',
          height: 80,
          fit: BoxFit.contain,
        ),
        centerTitle: true,
        leadingWidth: 110, // Adjusted for two icons
        leading: Row(
          children: [
            const SizedBox(width: 8),
            DemokShowcase(
              key: _govKey,
              description: "Découvrez la composition du gouvernement actuel.",
              child: IconButton(
                tooltip: 'Composition du gouvernement',
                icon: const Icon(Icons.account_balance, size: 26, color: Colors.black87),
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (context) => const GovernmentModal(),
                  );
                },
              ),
            ),
            DemokShowcase(
              key: _filterKey,
              description: "Filtrez les lois en cours de discussion ou consultez les résultats des votes passés.",
              child: IconButton(
                tooltip: _showVotedOnly ? 'Afficher toutes les lois' : 'Afficher uniquement les lois passées',
                icon: Icon(
                  _showVotedOnly ? Icons.fact_check : Icons.fact_check_outlined,
                  size: 26,
                  color: _showVotedOnly ? Colors.blue[700] : Colors.black87,
                ),
                onPressed: () {
                  setState(() {
                    _showVotedOnly = !_showVotedOnly;
                  });
                  _fetchLaws(refresh: true);
                },
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(
              _showFavoritesOnly ? Icons.star : Icons.star_border,
              size: 28,
              color: UserSession().isGuest 
                  ? Colors.grey[400] 
                  : (_showFavoritesOnly ? Colors.amber[600] : Colors.black),
            ),
            tooltip: 'Mes lois favorites',
            onPressed: UserSession().isGuest ? () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Inscrivez-vous pour utiliser les favoris !')),
              );
            } : () {
              setState(() {
                _showFavoritesOnly = !_showFavoritesOnly;
              });
            },
          ),
          DemokShowcase(
            key: _profileKey,
            description: "Accédez à votre profil pour suivre votre progression, vos badges et gérer vos informations.",
            child: IconButton(
              icon: Icon(Icons.person_outline, size: 28, color: UserSession().isGuest ? Colors.grey[400] : Colors.black),
              onPressed: UserSession().isGuest ? () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Inscrivez-vous pour accéder au profil !')),
                );
              } : () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const ProfileScreen()),
                );
              },
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Stack(
        children: [
          Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: DemokShowcase(
              key: _searchKey,
              description: "Recherchez une loi spécifique par mot-clé.",
              child: TextField(
                decoration: InputDecoration(
                  hintText: 'Rechercher une loi...',
                  prefixIcon: const Icon(Icons.search, color: Colors.grey),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(30),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(30),
                    borderSide: BorderSide(color: Colors.grey[200]!),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(30),
                    borderSide: const BorderSide(color: Colors.black, width: 1.5),
                  ),
                ),
                onChanged: _onSearchChanged,
              ),
            ),
          ),
          Expanded(
            child: _isLoading
                ? ListView.builder(
                    itemCount: 5,
                    padding: const EdgeInsets.only(bottom: 16),
                    itemBuilder: (context, index) => const SkeletonLawCard(),
                  )
                : Builder(
                    builder: (context) {
                      if (_selectedTabIndex == 0) {
                        return displayedLaws.isEmpty
                            ? Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.search_off, size: 64, color: Colors.grey[300]),
                                    const SizedBox(height: 16),
                                    Text(
                                      _searchQuery.isNotEmpty
                                          ? 'Aucun résultat pour "$_searchQuery"'
                                          : 'Aucune loi disponible',
                                      style: const TextStyle(fontSize: 16, color: Colors.grey),
                                    ),
                                  ],
                                ),
                              )
                            : RefreshIndicator(
                                onRefresh: () => _fetchLaws(refresh: true),
                                child: ListView.builder(
                                  controller: _lawsScrollController,
                                  itemCount: displayedLaws.length + (_isLoadingMore ? 1 : 0),
                                  padding: const EdgeInsets.only(bottom: 16),
                                  itemBuilder: (context, index) {
                                    if (index == displayedLaws.length) {
                                      return const Padding(
                                        padding: EdgeInsets.symmetric(vertical: 16),
                                        child: Center(child: CircularProgressIndicator()),
                                      );
                                    }

                                    Widget card = LawCard(
                                      law: displayedLaws[index],
                                      onTap: () {
                                        // Save scroll position before navigating
                                        if (_lawsScrollController.hasClients) {
                                          _savedScrollOffset = _lawsScrollController.offset;
                                        }
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (context) => LawDetailScreen(law: displayedLaws[index]),
                                          ),
                                        ).then((didVote) {
                                          if (didVote == true) {
                                            // User voted: refresh the law card data then restore position
                                            _fetchLaws(refresh: true).then((_) {
                                              WidgetsBinding.instance.addPostFrameCallback((_) {
                                                if (_lawsScrollController.hasClients) {
                                                  _lawsScrollController.jumpTo(_savedScrollOffset.clamp(
                                                    0.0,
                                                    _lawsScrollController.position.maxScrollExtent,
                                                  ));
                                                }
                                              });
                                            });
                                          } else {
                                            // No vote: just restore position without re-fetching
                                            WidgetsBinding.instance.addPostFrameCallback((_) {
                                              if (_lawsScrollController.hasClients) {
                                                _lawsScrollController.jumpTo(_savedScrollOffset.clamp(
                                                  0.0,
                                                  _lawsScrollController.position.maxScrollExtent,
                                                ));
                                              }
                                            });
                                          }
                                        });
                                      },
                                    );

                                    if (index == 0 && _searchQuery.isEmpty) {
                                      return DemokShowcase(
                                        key: _lawKey,
                                        description: "Consultez les dates clés de l'Agenda et les détails de chaque projet de loi.",
                                        child: card,
                                      );
                                    }
                                    return card;
                                  },
                                ),
                              );
                      } else if (_selectedTabIndex == 1) {
                        return ListView(
                          padding: const EdgeInsets.only(bottom: 16),
                          children: [
                            SurveyCard(
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => const SurveysScreen(),
                                  ),
                                );
                              },
                            ),
                            const SizedBox(height: 16),
                            ..._topicPolls.map((poll) => TopicPollCard(
                              slug: poll['slug'] as String,
                              question: poll['question'] as String,
                              description: poll['description'] as String? ?? '',
                            )),
                          ],
                        );
                      } else {
                        // Onglet Débats — utilise le feed dédié
                        if (_isLoadingDebates) {
                          return ListView.builder(
                            itemCount: 5,
                            padding: const EdgeInsets.only(bottom: 16),
                            itemBuilder: (context, index) => const SkeletonLawCard(),
                          );
                        }
                        return _activeDebateLaws.isEmpty
                            ? Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.forum_outlined, size: 64, color: Colors.grey[300]),
                                    const SizedBox(height: 16),
                                    const Text(
                                      'Aucun débat disponible',
                                      style: TextStyle(fontSize: 16, color: Colors.grey),
                                    ),
                                  ],
                                ),
                              )
                            : RefreshIndicator(
                                onRefresh: _fetchActiveDebates,
                                child: ListView.builder(
                                  controller: _debatesScrollController,
                                  itemCount: _activeDebateLaws.length,
                                  padding: const EdgeInsets.only(bottom: 16),
                                  itemBuilder: (context, index) {
                                    final card = DebateCard(
                                      law: _activeDebateLaws[index],
                                      onTap: () {
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (context) => DebateDetailScreen(law: _activeDebateLaws[index]),
                                          ),
                                        );
                                      },
                                    );

                                    if (index == 0) {
                                      return DemokShowcase(
                                        key: _firstDebateKey,
                                        description: "Entrez dans l'hémicycle : suivez les échanges de la communauté Démok et donnez votre avis.",
                                        child: card,
                                      );
                                    }

                                    return card;
                                  },
                                ),
                              );
                      }
                    },
                  ),
          ),
        ],
      ),  // fin Column
          // ---- Bannière PWA flottante ----
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 350),
            transitionBuilder: (child, animation) => SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0, 1),
                end: Offset.zero,
              ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
              child: child,
            ),
            child: _showPwaBanner
                ? GestureDetector(
                    key: const ValueKey('pwa_banner'),
                      child: Align(
                      alignment: Alignment.bottomCenter,
                      child: PwaInstallService().isIos
                          ? IosInstallBanner(
                              onDismiss: () => _hidePwaBanner(),
                            )
                          : (PwaInstallService().canInstallAndroid 
                              ? AndroidInstallBanner(
                                  onDismiss: () => _hidePwaBanner(),
                                )
                              : const SizedBox.shrink()),
                    ),
                  )
                : const SizedBox.shrink(key: ValueKey('no_banner')),
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedTabIndex,
        onTap: (index) {
          if (UserSession().isGuest && (index == 1 || index == 2)) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Inscrivez-vous pour accéder à cette rubrique !')),
            );
            return;
          }
          setState(() {
            _selectedTabIndex = index;
          });

          if (index == 2 && !UserSession().hasSeenDebatesShowcase && _laws.isNotEmpty) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              Future.delayed(const Duration(milliseconds: 500), () {
                if (mounted) {
                  ShowCaseWidget.of(context).startShowCase([_firstDebateKey]);
                  UserSession().setDebatesShowcaseSeen();
                }
              });
            });
          }
        },
        items: [
          const BottomNavigationBarItem(
            icon: Icon(Icons.article),
            label: 'Lois',
          ),
          BottomNavigationBarItem(
            icon: DemokShowcase(
              key: _surveyTabKey,
              description: "Participez aux sondages sur la présidentielle 2027 et sur les grands sujets de société.",
              targetShapeBorder: const CircleBorder(),
              child: Icon(Icons.poll, color: UserSession().isGuest ? Colors.grey[400] : null),
            ),
            label: 'Sondages',
          ),
          BottomNavigationBarItem(
            icon: DemokShowcase(
              key: _debateTabKey,
              description: "Suivez les débats et les échanges de la communauté Démok.",
              targetShapeBorder: const CircleBorder(),
              child: Icon(Icons.groups, color: UserSession().isGuest ? Colors.grey[400] : null),
            ),
            label: 'Débats',
          ),
        ],
      ),
    );
  }
}
