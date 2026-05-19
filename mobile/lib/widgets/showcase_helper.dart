import 'package:flutter/material.dart';
import 'package:showcaseview/showcaseview.dart';

/// Un wrapper autour de ShowCaseWidget qui affiche automatiquement un bouton
/// "Passer" (Skip) moderne et cliquable au-dessus de la barrière modale du Showcase.
class DemokShowcaseWidget extends StatefulWidget {
  final Widget Function(BuildContext) builder;
  final VoidCallback onFinish;
  final VoidCallback? onStart;
  final VoidCallback? onShowcaseFinished; // callback supplémentaire après fin OU skip
  final bool disableBarrierInteraction;

  const DemokShowcaseWidget({
    super.key,
    required this.builder,
    required this.onFinish,
    this.onStart,
    this.onShowcaseFinished,
    this.disableBarrierInteraction = false,
  });

  @override
  State<DemokShowcaseWidget> createState() => _DemokShowcaseWidgetState();
}

class _DemokShowcaseWidgetState extends State<DemokShowcaseWidget> {
  OverlayEntry? _overlayEntry;
  bool _isActive = false;
  BuildContext? _showcaseContext;

  void _showSkipButton() {
    if (_showcaseContext == null || _overlayEntry != null) return;
    
    _overlayEntry = OverlayEntry(
      builder: (overlayContext) {
        final topPadding = MediaQuery.of(overlayContext).padding.top;
        return Positioned(
          top: topPadding + 12,
          right: 16,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: _dismissShowcase,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.blue[600],
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.2),
                      blurRadius: 6,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: const Text(
                  'Passer',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
    Overlay.of(_showcaseContext!).insert(_overlayEntry!);
  }

  void _hideSkipButton() {
    if (_overlayEntry != null) {
      _overlayEntry!.remove();
      _overlayEntry = null;
    }
  }

  void _dismissShowcase() {
    if (_showcaseContext == null) return;
    _hideSkipButton();
    ShowCaseWidget.of(_showcaseContext!).dismiss();
    widget.onFinish();
    widget.onShowcaseFinished?.call();
  }

  @override
  void dispose() {
    _hideSkipButton();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ShowCaseWidget(
      disableBarrierInteraction: widget.disableBarrierInteraction,
      onStart: (index, key) {
        if (!_isActive) {
          _isActive = true;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _showSkipButton();
          });
        }
        if (widget.onStart != null) {
          widget.onStart!();
        }
      },
      onFinish: () {
        _isActive = false;
        _hideSkipButton();
        widget.onFinish();
        widget.onShowcaseFinished?.call();
      },
      builder: (builderContext) {
        _showcaseContext = builderContext;
        return widget.builder(builderContext);
      },
    );
  }
}

/// Un wrapper autour de Showcase de la bibliothèque showcaseview
/// qui ajoute par défaut la progression automatique lors d'un clic
/// sur l'overlay sombre (la barrière modale) via onBarrierClick.
class DemokShowcase extends StatelessWidget {
  final GlobalKey key;
  final String description;
  final Widget child;
  final String? title;
  final Color tooltipBackgroundColor;
  final Color textColor;
  final TextStyle? descTextStyle;
  final TextStyle? titleTextStyle;
  final VoidCallback? onTargetClick;
  final VoidCallback? onBarrierClick;
  final bool disableBarrierInteraction;
  final ShapeBorder targetShapeBorder;
  final EdgeInsets targetPadding;

  const DemokShowcase({
    required this.key,
    required this.description,
    required this.child,
    this.title,
    this.tooltipBackgroundColor = Colors.white,
    this.textColor = Colors.black,
    this.descTextStyle,
    this.titleTextStyle,
    this.onTargetClick,
    this.onBarrierClick,
    this.disableBarrierInteraction = false,
    this.targetShapeBorder = const RoundedRectangleBorder(),
    this.targetPadding = const EdgeInsets.all(8),
  });

  @override
  Widget build(BuildContext context) {
    return Showcase(
      key: key,
      description: description,
      title: title,
      tooltipBackgroundColor: tooltipBackgroundColor,
      textColor: textColor,
      descTextStyle: descTextStyle,
      titleTextStyle: titleTextStyle,
      onTargetClick: onTargetClick,
      disableBarrierInteraction: disableBarrierInteraction,
      targetShapeBorder: targetShapeBorder,
      targetPadding: targetPadding,
      onBarrierClick: onBarrierClick ?? () {
        ShowCaseWidget.of(context).next();
      },
      child: child,
    );
  }
}
