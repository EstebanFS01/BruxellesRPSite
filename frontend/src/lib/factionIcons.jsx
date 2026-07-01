import { Shield, Heart, Wrench, Briefcase, GraduationCap, Newspaper, Truck, Pizza, Hammer, Scale, Building2, Radio, Star } from "lucide-react";

export const ICON_MAP = {
  shield: Shield,
  heart: Heart,
  wrench: Wrench,
  briefcase: Briefcase,
  graduation: GraduationCap,
  newspaper: Newspaper,
  truck: Truck,
  pizza: Pizza,
  hammer: Hammer,
  scale: Scale,
  building: Building2,
  radio: Radio,
};

export const ICON_KEYS = Object.keys(ICON_MAP);

export function FactionIcon({ icon_key, ...props }) {
  const C = ICON_MAP[icon_key] || Star;
  return <C {...props} />;
}
