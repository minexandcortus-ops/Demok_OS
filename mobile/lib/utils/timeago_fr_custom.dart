import 'package:timeago/timeago.dart';

class FrMessagesCustom extends FrMessages {
  @override
  String prefixPast() => 'il y a';
  @override
  String prefixFromNow() => 'd’ici';
  @override
  String suffixPast() => '';
  @override
  String suffixFromNow() => '';
  @override
  String lessThanOneMinute(int seconds) => 'quelques secondes';
  @override
  String aboutAMinute(int minutes) => 'une minute';
  @override
  String minutes(int minutes) => '$minutes minutes';
  @override
  String aboutAnHour(int minutes) => 'une heure';
  @override
  String hours(int hours) => '$hours heures';
  @override
  String aDay(int hours) => 'un jour';
  @override
  String days(int days) => '$days jours';
  @override
  String aboutAMonth(int days) => 'un mois';
  @override
  String months(int months) => '$months mois';
  @override
  String aboutAYear(int months) => 'un an';
  @override
  String years(int years) => '$years ans';
  @override
  String wordSeparator() => ' ';
}
