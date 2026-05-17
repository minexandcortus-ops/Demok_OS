import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app_colors.dart';

/// Démok Application Theme
/// Provides comprehensive theming for the entire application
class AppTheme {
  AppTheme._(); // Private constructor

  // ============================================================================
  // TYPOGRAPHY
  // ============================================================================
  
  /// Primary font family (Montserrat for headings)
  static const String fontFamilyPrimary = 'Montserrat';
  
  /// Secondary font family (Inter for body text)
  static const String fontFamilySecondary = 'Inter';

  /// Base text theme
  static const TextTheme _baseTextTheme = TextTheme(
    // Display styles (largest)
    displayLarge: TextStyle(
      fontFamily: fontFamilyPrimary,
      fontSize: 57,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.25,
      height: 1.12,
    ),
    displayMedium: TextStyle(
      fontFamily: fontFamilyPrimary,
      fontSize: 45,
      fontWeight: FontWeight.w700,
      letterSpacing: 0,
      height: 1.16,
    ),
    displaySmall: TextStyle(
      fontFamily: fontFamilyPrimary,
      fontSize: 36,
      fontWeight: FontWeight.w700,
      letterSpacing: 0,
      height: 1.22,
    ),
    
    // Headline styles
    headlineLarge: TextStyle(
      fontFamily: fontFamilyPrimary,
      fontSize: 32,
      fontWeight: FontWeight.w700,
      letterSpacing: 0,
      height: 1.25,
    ),
    headlineMedium: TextStyle(
      fontFamily: fontFamilyPrimary,
      fontSize: 28,
      fontWeight: FontWeight.w700,
      letterSpacing: 0,
      height: 1.29,
    ),
    headlineSmall: TextStyle(
      fontFamily: fontFamilyPrimary,
      fontSize: 24,
      fontWeight: FontWeight.w600,
      letterSpacing: 0,
      height: 1.33,
    ),
    
    // Title styles
    titleLarge: TextStyle(
      fontFamily: fontFamilyPrimary,
      fontSize: 22,
      fontWeight: FontWeight.w600,
      letterSpacing: 0,
      height: 1.27,
    ),
    titleMedium: TextStyle(
      fontFamily: fontFamilySecondary,
      fontSize: 16,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.15,
      height: 1.50,
    ),
    titleSmall: TextStyle(
      fontFamily: fontFamilySecondary,
      fontSize: 14,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.1,
      height: 1.43,
    ),
    
    // Body styles
    bodyLarge: TextStyle(
      fontFamily: fontFamilySecondary,
      fontSize: 16,
      fontWeight: FontWeight.w400,
      letterSpacing: 0.5,
      height: 1.50,
    ),
    bodyMedium: TextStyle(
      fontFamily: fontFamilySecondary,
      fontSize: 14,
      fontWeight: FontWeight.w400,
      letterSpacing: 0.25,
      height: 1.43,
    ),
    bodySmall: TextStyle(
      fontFamily: fontFamilySecondary,
      fontSize: 12,
      fontWeight: FontWeight.w400,
      letterSpacing: 0.4,
      height: 1.33,
    ),
    
    // Label styles
    labelLarge: TextStyle(
      fontFamily: fontFamilySecondary,
      fontSize: 14,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.1,
      height: 1.43,
    ),
    labelMedium: TextStyle(
      fontFamily: fontFamilySecondary,
      fontSize: 12,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.5,
      height: 1.33,
    ),
    labelSmall: TextStyle(
      fontFamily: fontFamilySecondary,
      fontSize: 11,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.5,
      height: 1.45,
    ),
  );

  // ============================================================================
  // LIGHT THEME
  // ============================================================================
  
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      
      // Color Scheme
      colorScheme: const ColorScheme.light(
        primary: AppColors.primaryBlue,
        onPrimary: AppColors.white,
        primaryContainer: AppColors.lightBlue,
        onPrimaryContainer: AppColors.darkBlue,
        
        secondary: AppColors.brandRed,
        onSecondary: AppColors.white,
        secondaryContainer: Color(0xFFFFDAD6),
        onSecondaryContainer: Color(0xFF410002),
        
        tertiary: AppColors.darkBlue,
        onTertiary: AppColors.white,
        tertiaryContainer: AppColors.paleBlue,
        onTertiaryContainer: AppColors.darkBlue,
        
        error: AppColors.error,
        onError: AppColors.white,
        errorContainer: Color(0xFFFFDAD6),
        onErrorContainer: Color(0xFF410002),
        
        background: AppColors.background,
        onBackground: AppColors.textPrimary,
        
        surface: AppColors.background,
        onSurface: AppColors.textPrimary,
        surfaceVariant: AppColors.backgroundSecondary,
        onSurfaceVariant: AppColors.textSecondary,
        
        outline: AppColors.border,
        outlineVariant: AppColors.divider,
        
        shadow: Color(0x1A000000),
        scrim: Color(0x80000000),
      ),
      
      // Scaffold
      scaffoldBackgroundColor: AppColors.background,
      
      // App Bar
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.primaryBlue,
        foregroundColor: AppColors.white,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          fontFamily: fontFamilyPrimary,
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: AppColors.white,
          letterSpacing: 0.15,
        ),
        iconTheme: IconThemeData(
          color: AppColors.white,
          size: 24,
        ),
        systemOverlayStyle: SystemUiOverlayStyle.light,
      ),
      
      // Card
      cardTheme: const CardThemeData(
        color: AppColors.white,
        elevation: 2,
        shadowColor: Color(0x14000000),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(12)),
        ),
        margin: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      ),
      
      // Elevated Button
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primaryBlue,
          foregroundColor: AppColors.white,
          elevation: 2,
          shadowColor: Colors.black.withValues(alpha: 0.15),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          textStyle: const TextStyle(
            fontFamily: fontFamilySecondary,
            fontSize: 16,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        ),
      ),
      
      // Outlined Button
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primaryBlue,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          side: const BorderSide(color: AppColors.primaryBlue, width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          textStyle: const TextStyle(
            fontFamily: fontFamilySecondary,
            fontSize: 16,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        ),
      ),
      
      // Text Button
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primaryBlue,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          textStyle: const TextStyle(
            fontFamily: fontFamilySecondary,
            fontSize: 14,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.1,
          ),
        ),
      ),
      
      // Floating Action Button
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.brandRed,
        foregroundColor: AppColors.white,
        elevation: 4,
        shape: CircleBorder(),
      ),
      
      // Input Decoration
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.backgroundSecondary,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.borderFocus, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.error, width: 2),
        ),
        labelStyle: const TextStyle(
          fontFamily: fontFamilySecondary,
          fontSize: 14,
          color: AppColors.textSecondary,
        ),
        hintStyle: const TextStyle(
          fontFamily: fontFamilySecondary,
          fontSize: 14,
          color: AppColors.textTertiary,
        ),
      ),
      
      // Chip
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.backgroundSecondary,
        labelStyle: const TextStyle(
          fontFamily: fontFamilySecondary,
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: AppColors.textPrimary,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
      
      // Divider
      dividerTheme: const DividerThemeData(
        color: AppColors.divider,
        thickness: 1,
        space: 1,
      ),
      
      // Bottom Navigation Bar
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.white,
        selectedItemColor: AppColors.primaryBlue,
        unselectedItemColor: AppColors.textSecondary,
        selectedLabelStyle: TextStyle(
          fontFamily: fontFamilySecondary,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
        unselectedLabelStyle: TextStyle(
          fontFamily: fontFamilySecondary,
          fontSize: 12,
          fontWeight: FontWeight.w400,
        ),
        elevation: 8,
        type: BottomNavigationBarType.fixed,
      ),
      
      // Text Theme
      textTheme: _baseTextTheme.apply(
        bodyColor: AppColors.textPrimary,
        displayColor: AppColors.textPrimary,
      ),
      
      // Icon Theme
      iconTheme: const IconThemeData(
        color: AppColors.textPrimary,
        size: 24,
      ),
      
      // Typography
      typography: Typography.material2021(),
    );
  }

  // ============================================================================
  // DARK THEME
  // ============================================================================
  
  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      
      // Color Scheme
      colorScheme: const ColorScheme.dark(
        primary: AppColors.lightBlue,
        onPrimary: AppColors.white,
        primaryContainer: AppColors.primaryBlue,
        onPrimaryContainer: AppColors.paleBlue,
        
        secondary: AppColors.brandRed,
        onSecondary: AppColors.white,
        secondaryContainer: Color(0xFF8C1D18),
        onSecondaryContainer: Color(0xFFFFDAD6),
        
        tertiary: AppColors.paleBlue,
        onTertiary: AppColors.darkBlue,
        tertiaryContainer: AppColors.darkBlue,
        onTertiaryContainer: AppColors.paleBlue,
        
        error: Color(0xFFFF5449),
        onError: Color(0xFF690005),
        errorContainer: Color(0xFF93000A),
        onErrorContainer: Color(0xFFFFDAD6),
        
        background: Color(0xFF121212),
        onBackground: Color(0xFFE2E2E5),
        
        surface: Color(0xFF1E1E1E),
        onSurface: Color(0xFFE2E2E5),
        surfaceVariant: Color(0xFF2C2C2E),
        onSurfaceVariant: Color(0xFFC7C7CC),
        
        outline: Color(0xFF48484A),
        outlineVariant: Color(0xFF3A3A3C),
        
        shadow: Colors.black,
        scrim: Colors.black,
      ),
      
      // Scaffold
      scaffoldBackgroundColor: const Color(0xFF121212),
      
      // App Bar
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF1E1E1E),
        foregroundColor: AppColors.white,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          fontFamily: fontFamilyPrimary,
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: AppColors.white,
          letterSpacing: 0.15,
        ),
        iconTheme: IconThemeData(
          color: AppColors.white,
          size: 24,
        ),
        systemOverlayStyle: SystemUiOverlayStyle.light,
      ),
      
      // Card
      cardTheme: const CardThemeData(
        color: Color(0xFF1E1E1E),
        elevation: 2,
        shadowColor: Color(0x4D000000),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(12)),
        ),
        margin: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      ),
      
      // Elevated Button
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.lightBlue,
          foregroundColor: AppColors.white,
          elevation: 2,
          shadowColor: Colors.black.withValues(alpha: 0.25),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          textStyle: const TextStyle(
            fontFamily: fontFamilySecondary,
            fontSize: 16,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        ),
      ),
      
      // Outlined Button
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.lightBlue,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          side: const BorderSide(color: AppColors.lightBlue, width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          textStyle: const TextStyle(
            fontFamily: fontFamilySecondary,
            fontSize: 16,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        ),
      ),
      
      // Text Button
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.lightBlue,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          textStyle: const TextStyle(
            fontFamily: fontFamilySecondary,
            fontSize: 14,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.1,
          ),
        ),
      ),
      
      // Floating Action Button
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.brandRed,
        foregroundColor: AppColors.white,
        elevation: 4,
        shape: CircleBorder(),
      ),
      
      // Input Decoration
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFF2C2C2E),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFF48484A)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFF48484A)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.lightBlue, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFFF5449)),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFFF5449), width: 2),
        ),
        labelStyle: const TextStyle(
          fontFamily: fontFamilySecondary,
          fontSize: 14,
          color: Color(0xFFC7C7CC),
        ),
        hintStyle: const TextStyle(
          fontFamily: fontFamilySecondary,
          fontSize: 14,
          color: Color(0xFF8E8E93),
        ),
      ),
      
      // Chip
      chipTheme: ChipThemeData(
        backgroundColor: const Color(0xFF2C2C2E),
        labelStyle: const TextStyle(
          fontFamily: fontFamilySecondary,
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: Color(0xFFE2E2E5),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
      
      // Divider
      dividerTheme: const DividerThemeData(
        color: Color(0xFF3A3A3C),
        thickness: 1,
        space: 1,
      ),
      
      // Bottom Navigation Bar
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Color(0xFF1E1E1E),
        selectedItemColor: AppColors.lightBlue,
        unselectedItemColor: Color(0xFF8E8E93),
        selectedLabelStyle: TextStyle(
          fontFamily: fontFamilySecondary,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
        unselectedLabelStyle: TextStyle(
          fontFamily: fontFamilySecondary,
          fontSize: 12,
          fontWeight: FontWeight.w400,
        ),
        elevation: 8,
        type: BottomNavigationBarType.fixed,
      ),
      
      // Text Theme
      textTheme: _baseTextTheme.apply(
        bodyColor: const Color(0xFFE2E2E5),
        displayColor: const Color(0xFFE2E2E5),
      ),
      
      // Icon Theme
      iconTheme: const IconThemeData(
        color: Color(0xFFE2E2E5),
        size: 24,
      ),
      
      // Typography
      typography: Typography.material2021(),
    );
  }
}
