export interface SocialLink {
  id: string;
  label: string;
  icon: string;
  url: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  {
    id: 'facebook',
    label: 'Facebook',
    icon: 'logo-facebook',
    url: 'https://www.facebook.com/profile.php?id=100070129624382',
  },
];
