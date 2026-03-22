import {
  Activity,
  Bike,
  Dumbbell,
  Footprints,
  Mountain,
  PersonStanding,
  Sailboat,
  Snowflake,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ACTIVITY_ICON_MAP: Record<string, LucideIcon> = {
  Run: PersonStanding,
  Ride: Bike,
  Swim: Waves,
  Walk: Footprints,
  Hike: Mountain,
  Yoga: PersonStanding,
  WeightTraining: Dumbbell,
  Workout: Dumbbell,
  CrossFit: Dumbbell,
  Kayaking: Sailboat,
  Canoeing: Sailboat,
  Rowing: Sailboat,
  AlpineSki: Snowflake,
  NordicSki: Snowflake,
  Snowboard: Snowflake,
  Surfing: Waves,
  IceSkate: Zap,
  InlineSkate: Zap,
};

export function getActivityIcon(type: string): LucideIcon {
  return ACTIVITY_ICON_MAP[type] || Activity;
}
