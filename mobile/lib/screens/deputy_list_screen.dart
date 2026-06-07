import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'dart:async';
import '../models/deputy.dart';
import '../services/deputies_service.dart';
import '../config/env.dart';
import 'deputy_detail_screen.dart';

class DeputyListScreen extends StatefulWidget {
  const DeputyListScreen({super.key});

  @override
  State<DeputyListScreen> createState() => _DeputyListScreenState();
}

class _DeputyListScreenState extends State<DeputyListScreen> {
  final ScrollController _scrollController = ScrollController();
  List<Deputy> _deputies = [];
  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  int _currentPage = 0;
  String _searchQuery = '';
  String _sortBy = 'name_asc';
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _fetchDeputies(refresh: true);
    _scrollController.addListener(() {
      if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200 && !_isLoadingMore && _hasMore) {
        _loadMore();
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      setState(() {
        _searchQuery = query;
        _isLoading = true;
        _currentPage = 0;
        _hasMore = true;
      });
      _fetchDeputies(refresh: true);
    });
  }

  Future<void> _fetchDeputies({bool refresh = false}) async {
    if (refresh) {
      _currentPage = 0;
      _hasMore = true;
    }
    try {
      final newDeputies = await DeputiesService.searchDeputies(query: _searchQuery, sortBy: _sortBy, limit: 20, offset: _currentPage * 20);
      setState(() {
        if (refresh) {
          _deputies = newDeputies;
          _isLoading = false;
        } else {
          _deputies.addAll(newDeputies);
          _isLoadingMore = false;
        }
        if (newDeputies.length < 20) _hasMore = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _isLoadingMore = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_isLoadingMore || !_hasMore) return;
    setState(() {
      _isLoadingMore = true;
      _currentPage++;
    });
    await _fetchDeputies();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  decoration: InputDecoration(
                    hintText: 'Rechercher un député...',
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
              const SizedBox(width: 8),
              PopupMenuButton<String>(
                icon: const Icon(Icons.filter_list, size: 28),
                tooltip: 'Trier par',
                onSelected: (String value) {
                  setState(() {
                    _sortBy = value;
                    _isLoading = true;
                  });
                  _fetchDeputies(refresh: true);
                },
                itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
                  const PopupMenuItem<String>(
                    value: 'name_asc',
                    child: Text('A-Z (Nom)'),
                  ),
                  const PopupMenuItem<String>(
                    value: 'party_asc',
                    child: Text('Parti politique'),
                  ),
                  const PopupMenuItem<String>(
                    value: 'dept_asc',
                    child: Text('Département'),
                  ),
                ],
              ),
            ],
          ),
        ),
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : _deputies.isEmpty
                  ? const Center(child: Text("Aucun député trouvé"))
                  : ListView.builder(
                      controller: _scrollController,
                      itemCount: _deputies.length + (_isLoadingMore ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index == _deputies.length) {
                          return const Padding(
                            padding: EdgeInsets.symmetric(vertical: 16.0),
                            child: Center(child: CircularProgressIndicator()),
                          );
                        }
                        final deputy = _deputies[index];
                        return Card(
                          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          child: ListTile(
                            leading: ClipOval(
                              child: Container(
                                width: 50,
                                height: 50,
                                color: Colors.grey[200],
                                child: deputy.photoUrl != null
                                    ? Image.network(
                                        deputy.photoUrl!.startsWith('http')
                                            ? deputy.photoUrl!
                                            : '${Env.apiUrl.replaceAll('/api', '')}${deputy.photoUrl!}',
                                        headers: kDebugMode ? const {'Bypass-Tunnel-Reminder': 'true'} : null,
                                        fit: BoxFit.cover,
                                        errorBuilder: (context, error, stackTrace) {
                                          return const Icon(Icons.person, color: Colors.grey);
                                        },
                                      )
                                    : const Icon(Icons.person, color: Colors.grey),
                              ),
                            ),
                            title: Text(deputy.fullName, style: const TextStyle(fontWeight: FontWeight.bold)),
                            subtitle: Text("${deputy.party ?? 'Sans étiquette'}\n${deputy.department ?? ''}"),
                            isThreeLine: true,
                            trailing: (deputy.isActive != null && !deputy.isActive!)
                                ? Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: Colors.red[100],
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Text(
                                      'Fin de mandat',
                                      style: TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.bold),
                                    ),
                                  )
                                : null,
                            onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => DeputyDetailScreen(deputy: deputy),
                                  ),
                                );
                            },
                          ),
                        );
                      },
                    ),
        ),
      ],
    );
  }
}
