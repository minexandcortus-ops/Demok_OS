import 'package:flutter/material.dart';
import '../models/chat_message.dart';
import 'typewriter_text.dart';

class ChatBubble extends StatelessWidget {
  final ChatMessage message;
  final bool shouldAnimate;

  const ChatBubble({
    super.key,
    required this.message,
    this.shouldAnimate = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        mainAxisAlignment:
            message.isBot ? MainAxisAlignment.start : MainAxisAlignment.end,
        children: [
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.7,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: message.isBot
                  ? Colors.grey[200]
                  : const Color(0xFF007AFF), // Apple blue
              borderRadius: BorderRadius.circular(20),
            ),
            child: message.richContent ??
                ((message.isBot && shouldAnimate)
                    ? TypewriterText(
                        message.text,
                        style: TextStyle(
                          color: message.isBot ? Colors.black87 : Colors.white,
                          fontSize: 16,
                        ),
                      )
                    : Text(
                        message.text,
                        style: TextStyle(
                          color: message.isBot ? Colors.black87 : Colors.white,
                          fontSize: 16,
                        ),
                      )),
          ),
        ],
      ),
    );
  }
}
