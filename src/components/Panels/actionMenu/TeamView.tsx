import TeamPanel from '../TeamPanel';
import type { 游戏状态 } from '../../../types/gameData';

interface TeamViewProps {
  roomPlayers: any[];
  gameData: 游戏状态;
  selfPlayerId: string;
}

export default function TeamView({ roomPlayers, gameData, selfPlayerId }: TeamViewProps) {
  return <TeamPanel roomPlayers={roomPlayers} gameData={gameData} selfPlayerId={selfPlayerId} />;
}
