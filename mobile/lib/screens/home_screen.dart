import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'dart:async';
import 'dart:convert';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../services/user_session.dart';
import '../models/law.dart';
import '../widgets/law_card.dart';
import '../widgets/skeleton_law_card.dart';
import '../widgets/government_modal.dart';
import 'law_detail_screen.dart';
import 'profile_screen.dart';
import 'surveys_screen.dart';
import 'deputy_list_screen.dart';
import '../services/api_client.dart';
import '../services/pwa_install_service.dart';
import '../widgets/android_install_banner.dart';
import '../widgets/ios_install_banner.dart';
import '../widgets/auth_prompt_modal.dart';
import '../services/push_notification_service.dart';

class HomeScreen extends StatelessWidget {
  final int initialTab;
  const HomeScreen({super.key, this.initialTab = 0});

  @override
  Widget build(BuildContext context) {
    // _HomeScreenContent expose son _schedulePwaBanner via la clé globale
    final contentKey = GlobalKey<_HomeScreenContentState>();
    return _HomeScreenContent(key: contentKey, initialTab: initialTab);
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



  // Pagination states
  int _currentPage = 1;
  bool _hasMoreLaws = true;
  bool _isLoadingMore = false;
  final ScrollController _lawsScrollController = ScrollController();
  double _savedScrollOffset = 0.0;

  final GlobalKey _govKey = GlobalKey();
  final GlobalKey _filterKey = GlobalKey();
  final GlobalKey _searchKey = GlobalKey();
  final GlobalKey _lawKey = GlobalKey();
  final GlobalKey _profileKey = GlobalKey();
  final GlobalKey _surveyTabKey = GlobalKey();
  final GlobalKey _deputyTabKey = GlobalKey();
  bool _showFavoritesOnly = false;
  bool _showVotedOnly = false;

  @override
  void initState() {
    super.initState();
    _selectedTabIndex = widget.initialTab;
    _fetchLaws();
    _fetchTopicPolls();


    _lawsScrollController.addListener(() {
      if (_lawsScrollController.position.pixels >= _lawsScrollController.position.maxScrollExtent - 200 && !_isLoadingMore && _hasMoreLaws) {
        _loadMoreLaws();
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

  
  /// Planifie l'affichage de la bannière PWA après un délai de 3 secondes.
  /// Ne s'affiche que pour les membres connectés (pas les invités),
  /// que si la PWA n'est pas déjà installée, et que si la fenêtre
  /// de cooldown est écoulée.
  void _schedulePwaBanner() {
    if (!mounted) return;
    if (!UserSession().isGuest && !UserSession().isLoggedIn) return;
    if (!UserSession().shouldShowPwaBanner) return;
    final pwa = PwaInstallService();
    if (pwa.isAlreadyInstalled) return;
    if (!pwa.isAndroid && !pwa.isIos) return;

    _pwaBannerTimer?.cancel();
    _pwaBannerTimer = Timer(const Duration(seconds: 20), () {
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

    super.dispose();
  }

  Future<void> _fetchTopicPolls() async {
    // Disabled temporarily for Presidential 2027 focus
    /*
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
    */
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

      final response = await ApiClient.get(path);

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

  Widget _buildTopIconButton({
    required Widget icon,
    required VoidCallback onPressed,
    String? tooltip,
    Color? backgroundColor,
    Color? borderColor,
  }) {
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: backgroundColor ?? AppColors.pillBackground,
        shape: BoxShape.circle,
        border: Border.all(
          color: borderColor ?? AppColors.cardBorderSubtle,
          width: 1,
        ),
      ),
      child: IconButton(
        icon: icon,
        tooltip: tooltip,
        onPressed: onPressed,
        padding: EdgeInsets.zero,
        splashRadius: 20,
      ),
    );
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
      backgroundColor: AppColors.scaffoldBackground,
      appBar: AppBar(
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: AppColors.white,
        automaticallyImplyLeading: false,
        toolbarHeight: 64,
        title: SvgPicture.asset(
          'assets/images/logo_demok_vf.svg',
          height: 40,
          fit: BoxFit.contain,
        ),
        centerTitle: true,
        leadingWidth: 104,
        leading: Row(
          mainAxisAlignment: MainAxisAlignment.start,
          children: [
            const SizedBox(width: 12),
            _buildTopIconButton(
              tooltip: 'Composition du gouvernement',
              icon: const Icon(Icons.account_balance_outlined, size: 19, color: AppColors.darkBlue),
              onPressed: () {
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (context) => const GovernmentModal(),
                );
              },
            ),
            const SizedBox(width: 8),
            _buildTopIconButton(
              tooltip: _showVotedOnly ? 'Afficher toutes les lois' : 'Afficher uniquement les lois passées',
              backgroundColor: _showVotedOnly ? AppColors.primaryBlue.withValues(alpha: 0.12) : null,
              borderColor: _showVotedOnly ? AppColors.primaryBlue : null,
              icon: Icon(
                _showVotedOnly ? Icons.fact_check_rounded : Icons.fact_check_outlined,
                size: 19,
                color: _showVotedOnly ? AppColors.primaryBlue : AppColors.textSecondary,
              ),
              onPressed: () {
                setState(() {
                  _showVotedOnly = !_showVotedOnly;
                });
                _fetchLaws(refresh: true);
              },
            ),
          ],
        ),
        actions: [
          _buildTopIconButton(
            tooltip: 'Mes lois favorites',
            backgroundColor: _showFavoritesOnly ? Colors.amber.withValues(alpha: 0.15) : null,
            borderColor: _showFavoritesOnly ? Colors.amber[700] : null,
            icon: Icon(
              _showFavoritesOnly ? Icons.star_rounded : Icons.star_outline_rounded,
              size: 20,
              color: _showFavoritesOnly ? Colors.amber[700] : AppColors.textSecondary,
            ),
            onPressed: UserSession().isGuest ? () {
              AuthPromptModal.show(
                context,
                title: 'Sauvegardez vos lois favorites',
                message: 'Créez un compte citoyen en quelques secondes pour enregistrer les textes qui vous intéressent et suivre leur évolution.',
              );
            } : () {
              setState(() {
                _showFavoritesOnly = !_showFavoritesOnly;
              });
            },
          ),
          const SizedBox(width: 8),
          _buildTopIconButton(
            tooltip: 'Mon profil',
            icon: const Icon(
              Icons.person_outline_rounded,
              size: 20,
              color: AppColors.textSecondary,
            ),
            onPressed: UserSession().isGuest ? () {
              AuthPromptModal.show(
                context,
                title: 'Votre espace citoyen',
                message: 'Créez un compte ou connectez-vous pour voter, suivre votre député et progresser dans vos niveaux de citoyenneté.',
              );
            } : () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const ProfileScreen()),
              );
            },
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: Stack(
        children: [
          Column(
        children: [
          if (_selectedTabIndex == 0)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.cardBorder, width: 1),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0F172A).withValues(alpha: 0.03),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: TextField(
                  decoration: InputDecoration(
                    hintText: 'Rechercher une loi, un mot-clé...',
                    hintStyle: const TextStyle(
                      fontFamily: AppTheme.fontFamilySecondary,
                      fontSize: 14,
                      color: AppColors.textTertiary,
                    ),
                    prefixIcon: const Icon(Icons.search_rounded, size: 20, color: AppColors.textTertiary),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.close_rounded, size: 18, color: AppColors.textTertiary),
                            onPressed: () {
                              _onSearchChanged('');
                            },
                          )
                        : null,
                    filled: false,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                                      return card;
                                    }
                                    return card;
                                  },
                                ),
                              );
                      } else if (_selectedTabIndex == 1) {
                        return const SurveysScreen();
                      } else {
                        return const DeputyListScreen();
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
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppColors.white,
          border: const Border(top: BorderSide(color: AppColors.cardBorderSubtle, width: 1)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0F172A).withValues(alpha: 0.04),
              blurRadius: 16,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: BottomNavigationBar(
            currentIndex: _selectedTabIndex,
            backgroundColor: Colors.transparent,
            elevation: 0,
            selectedItemColor: AppColors.primaryBlue,
            unselectedItemColor: AppColors.textTertiary,
            selectedLabelStyle: const TextStyle(
              fontFamily: AppTheme.fontFamilySecondary,
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.2,
            ),
            unselectedLabelStyle: const TextStyle(
              fontFamily: AppTheme.fontFamilySecondary,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
            type: BottomNavigationBarType.fixed,
            onTap: (index) {
              setState(() {
                _selectedTabIndex = index;
              });
            },
            items: const [
              BottomNavigationBarItem(
                icon: Padding(
                  padding: EdgeInsets.only(bottom: 3),
                  child: Icon(Icons.article_outlined, size: 22),
                ),
                activeIcon: Padding(
                  padding: EdgeInsets.only(bottom: 3),
                  child: Icon(Icons.article_rounded, size: 22),
                ),
                label: 'Lois',
              ),
              BottomNavigationBarItem(
                icon: Padding(
                  padding: EdgeInsets.only(bottom: 3),
                  child: Icon(
                    Icons.how_to_vote_outlined,
                    size: 22,
                  ),
                ),
                activeIcon: Padding(
                  padding: EdgeInsets.only(bottom: 3),
                  child: Icon(
                    Icons.how_to_vote_rounded,
                    size: 22,
                  ),
                ),
                label: 'Élection 2027',
              ),
              BottomNavigationBarItem(
                icon: Padding(
                  padding: EdgeInsets.only(bottom: 3),
                  child: Icon(Icons.people_outline_rounded, size: 22),
                ),
                activeIcon: Padding(
                  padding: EdgeInsets.only(bottom: 3),
                  child: Icon(Icons.people_rounded, size: 22),
                ),
                label: 'Députés',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
