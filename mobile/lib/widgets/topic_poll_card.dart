import 'package:flutter/material.dart';
import 'dart:convert';
import '../services/user_session.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';

class TopicPollCard extends StatefulWidget {
  final String slug;
  final String question;
  final String description;

  const TopicPollCard({
    super.key,
    required this.slug,
    required this.question,
    required this.description,
  });

  @override
  State<TopicPollCard> createState() => _TopicPollCardState();
}

class _TopicPollCardState extends State<TopicPollCard> {
  bool _loading = true;
  bool _hasVoted = false;
  bool _isModifyingVote = false;
  Map<String, dynamic>? _pollData;
  String? _error;

  final Map<String, Color> _choiceColors = {
    'pour': const Color(0xFF22C55E),
    'neutre': const Color(0xFFEAB308),
    'contre': const Color(0xFFEF4444),
  };

  final Map<String, IconData> _choiceIcons = {
    'pour': Icons.thumb_up_rounded,
    'neutre': Icons.remove_circle_outline_rounded,
    'contre': Icons.thumb_down_rounded,
  };

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      // Check has voted
      final hasVotedRes = await ApiClient.get(
        '/surveys/polls/${widget.slug}/has-voted',
      );
      final hasVoted = (hasVotedRes.statusCode == 200)
          ? (jsonDecode(hasVotedRes.body)['hasVoted'] ?? false)
          : false;

      // Get poll data
      final pollRes = await ApiClient.get('/surveys/polls/${widget.slug}');
      final pollData = pollRes.statusCode == 200 ? jsonDecode(pollRes.body) : null;

      if (mounted) {
        setState(() {
          _hasVoted = hasVoted;
          _pollData = pollData;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Erreur de chargement';
          _loading = false;
        });
      }
    }
  }

  Future<void> _vote(String choice) async {
    try {
      final res = await ApiClient.post(
        '/surveys/polls/${widget.slug}/vote',
        body: {'choice': choice},
      );

      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(res.body);
        setState(() {
          _hasVoted = true;
          _isModifyingVote = false;
          _pollData = data['poll'];
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur : $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Text(_error!, style: const TextStyle(color: Colors.red))
                : _buildContent(),
      ),
    );
  }

  Widget _buildContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.orange.shade50,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.orange.shade200),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.poll_outlined, size: 14, color: Colors.orange.shade700),
              const SizedBox(width: 5),
              Text(
                'Sondage d\'actualité',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Colors.orange.shade700,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        // Question
        Text(
          widget.question,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF1A1A2E),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          widget.description,
          style: TextStyle(fontSize: 13, color: Colors.grey[600], height: 1.4),
        ),
        const SizedBox(height: 16),
        if (!_hasVoted || _isModifyingVote) _buildVoteButtons() else _buildResults(),
      ],
    );
  }

  Widget _buildVoteButtons() {
    return Row(
      children: [
        _buildChoiceButton('pour', 'Pour'),
        const SizedBox(width: 8),
        _buildChoiceButton('neutre', 'Neutre'),
        const SizedBox(width: 8),
        _buildChoiceButton('contre', 'Contre'),
      ],
    );
  }

  Widget _buildChoiceButton(String choice, String label) {
    final color = _choiceColors[choice]!;
    final icon = _choiceIcons[choice]!;
    return Expanded(
      child: GestureDetector(
        onTap: () => _vote(choice),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: color.withAlpha(25),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withAlpha(100)),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 22),
              const SizedBox(height: 4),
              Text(label, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildResults() {
    final results = (_pollData?['results'] as List?) ?? [];
    final total = _pollData?['totalVotes'] ?? 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ...results.map<Widget>((r) {
          final choice = r['choice'] as String;
          final color = _choiceColors[choice] ?? Colors.grey;
          final pct = (r['percentage'] as num).toDouble();
          final votes = r['votes'];
          final icon = _choiceIcons[choice] ?? Icons.circle;
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: [
                Icon(icon, color: color, size: 16),
                const SizedBox(width: 8),
                SizedBox(
                  width: 52,
                  child: Text(r['label'], style: TextStyle(fontWeight: FontWeight.w600, color: color, fontSize: 13)),
                ),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: pct / 100,
                      backgroundColor: color.withAlpha(30),
                      valueColor: AlwaysStoppedAnimation(color),
                      minHeight: 10,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text('${pct.toStringAsFixed(1)}%', style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.bold)),
              ],
            ),
          );
        }).toList(),
        const SizedBox(height: 4),
        Text('$total vote${total > 1 ? 's' : ''}', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () {
              setState(() {
                _isModifyingVote = true;
              });
            },
            icon: const Icon(Icons.edit, size: 16),
            label: const Text('Modifier mon vote'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primaryBlue,
              side: const BorderSide(color: AppColors.primaryBlue),
              padding: const EdgeInsets.symmetric(vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
