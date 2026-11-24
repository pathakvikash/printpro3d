import { permanentRedirect } from 'next/navigation';

// The motor simulator now lives in the Build canvas (place motors, then Simulate).
export default function MotorTestPage() {
  permanentRedirect('/playground?mode=build&example=drone-plate&sim=1');
}
