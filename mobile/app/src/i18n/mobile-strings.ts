// Strings that exist only on the phone (screens the web does not have). Keys here win over the generated web strings.
export const MOBILE_STRINGS: Record<'en' | 'te', Record<string, string>> = {
  en: {
    'm.tab.home': 'Home', 'm.tab.live': 'Live', 'm.tab.social': 'Social', 'm.tab.history': 'History', 'm.tab.portfolio': 'Portfolio',
    'm.more': 'More', 'm.inbox': 'Inbox', 'm.team': 'Team', 'm.users': 'Users', 'm.saved': 'Saved stories', 'm.letters': 'Letters & petitions',
    'm.language': 'Language', 'm.language.value': 'English', 'm.signout': 'Sign out',
    'm.waiting': "What's waiting", 'm.caughtup': 'You are all caught up',
  },
  te: {
    'm.tab.home': 'హోమ్', 'm.tab.live': 'తాజా', 'm.tab.social': 'సోషల్', 'm.tab.history': 'చరిత్ర', 'm.tab.portfolio': 'పోర్ట్‌ఫోలియో',
    'm.more': 'మరిన్ని', 'm.inbox': 'ఇన్‌బాక్స్', 'm.team': 'బృందం', 'm.users': 'వినియోగదారులు', 'm.saved': 'సేవ్ చేసిన వార్తలు', 'm.letters': 'లేఖలు & వినతులు',
    'm.language': 'భాష', 'm.language.value': 'తెలుగు', 'm.signout': 'సైన్ అవుట్',
    'm.waiting': 'ఏమి వేచి ఉంది', 'm.caughtup': 'అన్నీ పూర్తయ్యాయి',
  },
};
