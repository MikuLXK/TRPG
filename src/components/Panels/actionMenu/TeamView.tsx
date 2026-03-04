import TeamPanel from '../TeamPanel';

interface TeamViewProps {
  players: any[];
}

export default function TeamView({ players }: TeamViewProps) {
  return <TeamPanel players={players} />;
}
