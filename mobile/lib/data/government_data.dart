class GovernmentMember {
  final String name;
  final String role;
  final bool isPresident;
  final bool isPM;
  final bool isMinisterEtat;

  const GovernmentMember({
    required this.name,
    required this.role,
    this.isPresident = false,
    this.isPM = false,
    this.isMinisterEtat = false,
  });

  factory GovernmentMember.fromJson(Map<String, dynamic> json) {
    return GovernmentMember(
      name: json['name'] as String,
      role: json['role'] as String,
      isPresident: json['isPresident'] as bool? ?? false,
      isPM: json['isPM'] as bool? ?? false,
      isMinisterEtat: json['isMinisterEtat'] as bool? ?? false,
    );
  }
}
