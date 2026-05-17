import 'package:flutter/material.dart';
import 'dart:convert';
import 'home_screen.dart';
import '../services/user_session.dart';
import '../theme/app_colors.dart';
import '../services/api_client.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _pseudoController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final FocusNode _pseudoFocus = FocusNode();
  final FocusNode _passwordFocus = FocusNode();
  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  Future<void> _showForgotPasswordDialog() async {
    final TextEditingController emailController = TextEditingController();
    bool isSubmitting = false;

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: Colors.white,
              title: const Text('Mot de passe oublié'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Entrez votre adresse email pour recevoir un lien de réinitialisation.'),
                  const SizedBox(height: 16),
                  TextField(
                    controller: emailController,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.emailAddress,
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: isSubmitting ? null : () => Navigator.pop(context),
                  child: const Text('Annuler', style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          final email = emailController.text.trim();
                          if (email.isEmpty) return;

                          setDialogState(() => isSubmitting = true);
                          try {
                            // Note: Expected to ignore response as we mock the email
                            await ApiClient.post('/auth/forgot-password', body: {'email': email});
                            if (mounted) {
                              Navigator.pop(context);
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Si cet email existe, un lien a été envoyé.'),
                                  backgroundColor: AppColors.primaryBlue,
                                ),
                              );
                            }
                          } catch (e) {
                            setDialogState(() => isSubmitting = false);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Erreur lors de la demande.'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primaryBlue),
                  child: isSubmitting
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Envoyer', style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _login() async {
    final String pseudo = _pseudoController.text.trim();
    final String password = _passwordController.text;
    
    if (pseudo.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = 'Veuillez remplir tous les champs';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await ApiClient.post('/auth/login', body: {
          'pseudo': pseudo,
          'password': password,
        });



// ... inside _login method ...

      if (response.statusCode == 201 || response.statusCode == 200) {
        final data = jsonDecode(response.body);
        
        // Save session
        await UserSession().saveSession(
          userId: data['userId'],
          citizenId: data['citizenId'],
          pseudo: data['pseudo'],
          email: data['email'],
          birthYear: data['birthYear'],
          token: data['accessToken'],
        );

        // Navigate to home with user data
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => const HomeScreen(),
            ),
          );
        }
      } else {
        try {
          final errorData = jsonDecode(response.body);
          setState(() {
            _errorMessage = errorData['message'] ?? 'Pseudo ou mot de passe incorrect';
          });
        } catch (_) {
          setState(() {
            _errorMessage = 'Pseudo ou mot de passe incorrect';
          });
        }
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Erreur de connexion au serveur';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: AppColors.primaryBlue),
      ),
      body: SafeArea(
        child: GestureDetector(
          onTap: () => FocusScope.of(context).unfocus(),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Connexion',
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primaryBlue,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Bon retour parmi nous !',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey[600],
                  ),
                ),
                const SizedBox(height: 48),
                
                // Pseudo field
                TextField(
                  controller: _pseudoController,
                  focusNode: _pseudoFocus,
                  textInputAction: TextInputAction.next,
                  keyboardType: TextInputType.text,
                  decoration: InputDecoration(
                    labelText: 'Pseudo',
                    prefixIcon: const Icon(Icons.person),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                  onSubmitted: (_) {
                    FocusScope.of(context).requestFocus(_passwordFocus);
                  },
                ),
                const SizedBox(height: 16),
                
                // Password field
                TextField(
                  controller: _passwordController,
                  focusNode: _passwordFocus,
                  obscureText: _obscurePassword,
                  textInputAction: TextInputAction.done,
                  decoration: InputDecoration(
                    labelText: 'Mot de passe',
                    prefixIcon: const Icon(Icons.lock),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword ? Icons.visibility_off : Icons.visibility,
                        color: Colors.grey[600],
                      ),
                      onPressed: () {
                        setState(() {
                          _obscurePassword = !_obscurePassword;
                        });
                      },
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                  onSubmitted: (_) => _login(),
                ),
                
                // Error message
                if (_errorMessage != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red[50],
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red[200]!),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline, color: Colors.red[700], size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: TextStyle(color: Colors.red[700]),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                
                const SizedBox(height: 24),
                
                // Login button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _login,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primaryBlue,
                      foregroundColor: Colors.white, // White text for visibility
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Se connecter',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),
                
                const SizedBox(height: 16),
                
                // Forgot password
                Center(
                  child: TextButton(
                    onPressed: _showForgotPasswordDialog,
                    child: const Text(
                      'Mot de passe oublié ?',
                      style: TextStyle(color: AppColors.primaryBlue),
                     ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _pseudoController.dispose();
    _passwordController.dispose();
    _pseudoFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }
}
