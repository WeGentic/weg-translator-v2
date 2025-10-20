import type { ProjectLanguagePair } from "@/shared/types/database";
import { Badge } from "@/shared/ui/badge";

import styles from "./LanguageSubheader.module.css";

export interface LanguageSubheaderProps {
  languagePairs?: ProjectLanguagePair[];
}

export function LanguageSubheader({
  languagePairs = [],
}: LanguageSubheaderProps) {
  const badges = mapLanguagePairsToBadges(languagePairs);

  return (
    <section className={styles.root} aria-label="Project language pairs">
      <span className={styles.label}>Language pairs</span>
      <div className={styles.badges}>
        {badges.length > 0 ? (
          badges.map((badge, index) => (
            <Badge key={badge} variant="outline" className={resolveToneClass(index)}>
              {badge}
            </Badge>
          ))
        ) : (
          <span className={styles.badgesEmpty}>Language pairs pending</span>
        )}
      </div>
    </section>
  );
}

function mapLanguagePairsToBadges(languagePairs: ProjectLanguagePair[]) {
  if (!Array.isArray(languagePairs) || languagePairs.length === 0) {
    return [];
  }

  const uniquePairs = new Set<string>();
  const formatted: string[] = [];

  for (const pair of languagePairs) {
    if (!pair?.sourceLang || !pair?.targetLang) {
      continue;
    }
    const normalizedSource = pair.sourceLang.trim();
    const normalizedTarget = pair.targetLang.trim();
    if (!normalizedSource || !normalizedTarget) {
      continue;
    }

    const key = `${normalizedSource.toLowerCase()}-${normalizedTarget.toLowerCase()}`;
    if (uniquePairs.has(key)) {
      continue;
    }
    uniquePairs.add(key);
    formatted.push(`${normalizedSource} → ${normalizedTarget}`);
  }

  return formatted;
}

const TONE_CLASSES = [
  styles.badgeTone0,
  styles.badgeTone1,
  styles.badgeTone2,
  styles.badgeTone3,
  styles.badgeTone4,
];

function resolveToneClass(index: number) {
  if (TONE_CLASSES.length === 0) {
    return undefined;
  }
  return TONE_CLASSES[index % TONE_CLASSES.length];
}
