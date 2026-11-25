import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/category.dart';
import '../models/territory.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';

Future<List<Category>> fetchCategories() async {
  final response = await ApiClient.get('/categories');
  if (response.statusCode != 200) return [];
  return (jsonDecode(response.body) as List<dynamic>)
      .map((e) => Category.fromJson(e))
      .toList();
}

/// Filtres du flux : un thème et/ou un territoire (sélection unique par axe).
class LawFiltersBar extends StatefulWidget {
  final int? selectedCategoryId;
  final String? selectedTerritory;
  final ValueChanged<int?> onCategoryChanged;
  final ValueChanged<String?> onTerritoryChanged;
  final Future<List<Category>> Function() categoriesLoader;

  const LawFiltersBar({
    super.key,
    required this.selectedCategoryId,
    required this.selectedTerritory,
    required this.onCategoryChanged,
    required this.onTerritoryChanged,
    this.categoriesLoader = fetchCategories,
  });

  @override
  State<LawFiltersBar> createState() => _LawFiltersBarState();
}

class _LawFiltersBarState extends State<LawFiltersBar> {
  List<Category> _categories = const [];

  @override
  void initState() {
    super.initState();
    widget.categoriesLoader().then((c) {
      if (mounted) setState(() => _categories = c);
    }).catchError((_) {});
  }

  Widget _chip(
      {required Key key,
      required String label,
      required bool selected,
      required VoidCallback onTap}) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: FilterChip(
        key: key,
        label: Text(label, style: const TextStyle(fontSize: 12)),
        selected: selected,
        showCheckmark: false,
        selectedColor: AppColors.primaryBlue.withValues(alpha: 0.15),
        side: BorderSide(
            color: selected ? AppColors.primaryBlue : AppColors.cardBorder),
        onSelected: (_) => onTap(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Row(children: [
        ...Territory.filterCodes.map((code) {
          final t = Territory.of(code);
          final selected = widget.selectedTerritory == code;
          return _chip(
            key: Key('territory-$code'),
            label: '${t.icon} ${t.label}',
            selected: selected,
            onTap: () => widget.onTerritoryChanged(selected ? null : code),
          );
        }),
        if (_categories.isNotEmpty)
          Container(
              width: 1,
              height: 24,
              margin: const EdgeInsets.only(right: 6),
              color: AppColors.divider),
        ..._categories.map((c) {
          final selected = widget.selectedCategoryId == c.id;
          return _chip(
            key: Key('category-${c.slug}'),
            label: '${c.icon} ${c.name}',
            selected: selected,
            onTap: () => widget.onCategoryChanged(selected ? null : c.id),
          );
        }),
      ]),
    );
  }
}

/// Thèmes et territoires d'une loi (fiche détail).
class LawClassificationChips extends StatelessWidget {
  final List<Category> categories;
  final List<String> territories;

  const LawClassificationChips(
      {super.key, required this.categories, required this.territories});

  @override
  Widget build(BuildContext context) {
    final places = Territory.displayable(territories);
    if (categories.isEmpty && places.isEmpty) return const SizedBox.shrink();
    Widget pill(String text, {Key? key}) => Container(
          key: key,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
              color: AppColors.pillBackground,
              borderRadius: BorderRadius.circular(12)),
          child: Text(text,
              style:
                  const TextStyle(fontSize: 12, color: AppColors.textPrimary)),
        );
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Wrap(spacing: 6, runSpacing: 6, children: [
        ...categories.map(
            (c) => pill('${c.icon} ${c.name}', key: Key('theme-${c.slug}'))),
        ...places.map(
            (t) => pill('${t.icon} ${t.label}', key: Key('place-${t.code}'))),
      ]),
    );
  }
}
