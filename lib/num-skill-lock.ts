import rawLock from "@/data/num-skill-lock.json";
import { numSkillLockSchema } from "@/lib/num-skill";

/** Selected raw rows only. Local game exports are never read by consumers. */
export const NUM_SKILL_LOCK = numSkillLockSchema.parse(rawLock);
