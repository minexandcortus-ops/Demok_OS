import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import '../models/chat_message.dart';
import '../widgets/chat_bubble.dart';
import 'dart:convert';
import '../services/user_session.dart';
import '../services/api_client.dart';
import 'otp_screen.dart';
import '../widgets/legal_dialogs.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> with WidgetsBindingObserver {
  final List<ChatMessage> _messages = [];
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  OnboardingStep _currentStep = OnboardingStep.intro;
  bool _isLoading = false;
  bool _obscurePassword = true;

  // User data
  String _pseudo = '';
  int _birthYear = 0;
  String _postalCode = '';
  String _email = '';
  String _password = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _addBotMessage(
        "Salut ! Bienvenue sur Démok, l'application qui te permet de suivre et de voter les lois en même temps que les députés.\n\nDémok est un outil apartisant (affilié à aucun parti politique) et n'a pas de but lucratif.\n\nToutes les données concernant nos utilisateurs sont chiffrées et ne peuvent être exploitées ni par Démok, ni aucun autre organisme.");
  }

  void _onConfirmIntro() {
    _addBotMessage(
        "Parfait ! Je suis là pour t'aider à configurer ton profil citoyen. On commence ? Quel est ton pseudo ?");
    setState(() {
      _currentStep = OnboardingStep.welcome;
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  void didChangeMetrics() {
    super.didChangeMetrics();
    // Wait for the layout to recalculate after keyboard pops up, then scroll to bottom
    Future.delayed(const Duration(milliseconds: 250), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _addBotMessage(String text) {
    setState(() {
      _messages.add(ChatMessage(text: text, isBot: true));
    });
    _scrollToBottom();
  }

  void _addUserMessage(String text) {
    setState(() {
      _messages.add(ChatMessage(text: text, isBot: false));
    });
    _scrollToBottom();
  }

  void _addLegalMessage() {
    setState(() {
      _messages.add(ChatMessage(
        text: "C'est tout bon ! En cliquant sur 'C'est parti', tu acceptes nos CGU et Politique de confidentialité.",
        isBot: true,
        richContent: RichText(
          text: TextSpan(
            style: const TextStyle(
              color: Colors.black87,
              fontSize: 16,
            ),
            children: [
              const TextSpan(text: "C'est tout bon ! En cliquant sur 'C'est parti', tu acceptes nos "),
              TextSpan(
                text: 'CGU',
                style: const TextStyle(
                  color: Color(0xFF007AFF),
                  decoration: TextDecoration.underline,
                  fontWeight: FontWeight.bold,
                ),
                recognizer: TapGestureRecognizer()
                  ..onTap = _showCGU,
              ),
              const TextSpan(text: ' et '),
              TextSpan(
                text: 'Politique de confidentialité',
                style: const TextStyle(
                  color: Color(0xFF007AFF),
                  decoration: TextDecoration.underline,
                  fontWeight: FontWeight.bold,
                ),
                recognizer: TapGestureRecognizer()
                  ..onTap = _showPrivacyPolicy,
              ),
              const TextSpan(text: '.'),
            ],
          ),
        ),
      ));
    });
    _scrollToBottom();
  }

  void _showCGU() {
    LegalDialogs.showCGU(context);
  }

  void _showPrivacyPolicy() {
    LegalDialogs.showPrivacyPolicy(context);
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 150), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _handleUserInput(String input) async {
    if (input.trim().isEmpty || _isLoading) return;

    final sanitizedInput = input.trim();
    
    String displayInput = input;
    if (_currentStep == OnboardingStep.email) {
      displayInput = '••••••••';
    }

    _addUserMessage(displayInput); // Show original input to the user
    _controller.clear();

    switch (_currentStep) {
      case OnboardingStep.welcome:
        if (sanitizedInput.length > 20) {
          _addBotMessage("Ton pseudo ne peut pas dépasser 20 caractères. Choisis-en un plus court !");
          return;
        }
        if (sanitizedInput.contains(' ')) {
          _addBotMessage("Ton pseudo ne peut pas contenir d'espace. Tout attaché !");
          return;
        }
        setState(() => _isLoading = true);
        try {
          final response = await ApiClient.get('/auth/check-pseudo?pseudo=$sanitizedInput');
          if (response.statusCode == 200) {
            final data = jsonDecode(response.body);
            if (data['available'] == true) {
              _pseudo = sanitizedInput;
              _currentStep = OnboardingStep.pseudo;
              _addBotMessage(
                  "Enchanté $_pseudo ! Quelques infos rapides avant de démarrer : Quelle est ton année de naissance ? (C'est pour vérifier que tu es bien majeur).");
            } else {
              final String suggestions = (data['suggestions'] as List).join(", ");
              _addBotMessage(
                "Oups, ce pseudo est déjà pris. Que dis-tu de : $suggestions ? Ou choisis-en un autre."
              );
            }
          } else {
            _addBotMessage("Oups, impossible de vérifier le pseudo. Réessaye.");
          }
        } catch (e) {
          _addBotMessage("Erreur de connexion. Réessaye.");
        } finally {
          setState(() => _isLoading = false);
        }
        break;

      case OnboardingStep.pseudo:
        final parsedYear = int.tryParse(sanitizedInput);
        final currentYear = DateTime.now().year;

        if (parsedYear == null || parsedYear > currentYear || parsedYear < 1850) {
          _addBotMessage("Hmm, cette année ne semble pas valide. Peux-tu renseigner ton année de naissance sous la forme de 4 chiffres (ex: 1990) ?");
          return;
        }

        _birthYear = parsedYear;
        
        // Vérification de la majorité
        final age = currentYear - _birthYear;

        if (age > 100) {
          _addBotMessage("Waouh, $age ans ! Félicitations pour cette longévité ! 🐢 Mais blague à part, peux-tu renseigner ta vraie année de naissance ?");
          return;
        }
        
        if (age < 18) {
          // Mineur - Message sympathique et arrêt
          final yearsRemaining = 18 - age;
          _currentStep = OnboardingStep.complete;
          _addBotMessage(
            "Désolé $_pseudo, Démok est réservé aux personnes majeures. "
            "Dans ${yearsRemaining == 1 ? 'un an' : '$yearsRemaining ans'}, tu seras le${age >= 17 ? '' : '/la'} bienvenu${age >= 17 ? '' : '(e)'} pour participer au débat public sur Démok ! 🗳️ "
            "En attendant, continue à t'informer sur l'actualité politique ! À bientôt ! 👋"
          );
          return;
        }
        
        _currentStep = OnboardingStep.birthYear;
        _addBotMessage(
            "Noté. Et ton Code Postal ? (C'est pour trouver ta circonscription et ton député).");
        break;

      case OnboardingStep.birthYear:
        // Validation : 5 chiffres correspondant à un département français existant (01-95, 97, 98)
        final postalCodeRegex = RegExp(r'^(?:0[1-9]|[1-8][0-9]|9[0-5]|97|98)[0-9]{3}$');
        if (!postalCodeRegex.hasMatch(sanitizedInput)) {
          _addBotMessage(
            "Ce code postal ne semble pas valide. Merci de renseigner un vrai code postal français à 5 chiffres (ex: 75001, 97400)."
          );
          return;
        }

        _postalCode = sanitizedInput;
        _currentStep = OnboardingStep.postalCode;
        _addBotMessage(
            "Parfait. Dernière étape pour sécuriser ton compte : ton email.");
        break;

      case OnboardingStep.postalCode:
        _email = sanitizedInput.toLowerCase();
        _currentStep = OnboardingStep.email;
        _addBotMessage("Et maintenant, choisis un mot de passe sécurisé.");
        break;

      case OnboardingStep.email:
        _password = input;
        setState(() {
          _currentStep = OnboardingStep.readyToSubmit;
        });
        _addLegalMessage();
        break;

      default:
        break;
    }
  }

  Future<void> _submitOnboarding() async {
    try {
      final response = await ApiClient.post('/auth/register', body: {
          'pseudo': _pseudo,
          'birthYear': _birthYear,
          'postalCode': _postalCode,
          'email': _email,
          'password': _password,
        });



// ... inside _submitOnboarding ...

      if (response.statusCode == 201 || response.statusCode == 200) {
        final data = jsonDecode(response.body);
        
        // Save session
        await UserSession().saveSession(
          userId: data['userId'],
        );
        
        _addBotMessage("🎉 Compte créé ! Vérifie ton email pour obtenir ton code de validation.");
        setState(() {
          _currentStep = OnboardingStep.complete;
        });
        // Navigate to OTP verification screen
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (context) => OtpScreen(
                  userId: data['userId'],
                  email: _email,
                ),
              ),
            );
          }
        });
      } else {
        try {
          final errorData = jsonDecode(response.body);
          final String errMsg = errorData['message'] ?? "Erreur inconnue";
          _addBotMessage("Oups : $errMsg. Vérifie tes informations et réessaie.");
        } catch (_) {
          _addBotMessage("Oups, une erreur s'est produite. Vérifie tes informations.");
        }
      }
    } catch (e) {
      _addBotMessage("Erreur de connexion au serveur. Réessaye plus tard.");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Démok',
          style: TextStyle(
            color: Colors.black,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                return ChatBubble(
                  message: _messages[index],
                  shouldAnimate: index == _messages.length - 1,
                );
              },
            ),
          ),
          if (_currentStep == OnboardingStep.intro)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: Colors.grey[300]!)),
              ),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _onConfirmIntro,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF007AFF),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    "Je comprends",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            )
          else if (_currentStep == OnboardingStep.readyToSubmit)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: Colors.grey[300]!)),
              ),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _submitOnboarding,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF007AFF),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    "C'est parti ! 🚀",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            )
          else if (_currentStep != OnboardingStep.complete)
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: Colors.grey[300]!)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      decoration: InputDecoration(
                        hintText: 'Tape ta réponse...',
                        border: const OutlineInputBorder(),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        suffixIcon: _currentStep == OnboardingStep.email
                            ? IconButton(
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_off
                                      : Icons.visibility,
                                  color: Colors.grey[600],
                                ),
                                onPressed: () {
                                  setState(() {
                                    _obscurePassword = !_obscurePassword;
                                  });
                                },
                              )
                            : null,
                      ),
                      onSubmitted: _handleUserInput,
                      obscureText: _currentStep == OnboardingStep.email && _obscurePassword,
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: _isLoading ? null : () => _handleUserInput(_controller.text),
                    icon: _isLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Color(0xFF007AFF),
                            ),
                          )
                        : const Icon(
                            Icons.send,
                            color: Color(0xFF007AFF),
                          ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
