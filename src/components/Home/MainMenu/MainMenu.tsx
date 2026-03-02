import React from 'react';
import { Crown, Plus, Users, Settings, UploadCloud, Cloud } from 'lucide-react';
import MenuButton from '../../UI/MenuButton';

interface MainMenuProps {
  setView: (view: 'main' | 'create' | 'join' | 'workshop' | 'cloud') => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
}

export default function MainMenu({ setView, setIsSettingsOpen }: MainMenuProps) {
  return (
    <>
      {/* Title Section */}
      <div className="mb-16 text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="w-16 h-[2px] bg-gradient-to-r from-transparent to-amber-500"></div>
          <Crown size={48} className="text-amber-500" />
          <div className="w-16 h-[2px] bg-gradient-to-l from-transparent to-amber-500"></div>
        </div>
        <h1 className="text-6xl font-bold text-amber-500 font-serif tracking-[0.2em] mb-2 text-shadow-glow">
          永夜之都
        </h1>
        <p className="text-zinc-500 tracking-[0.5em] text-sm uppercase">Eternal Night City - TRPG Platform</p>
      </div>

      {/* Menu Options */}
      <div className="w-full max-w-md space-y-4">
        <MenuButton
          onClick={() => setView('create')}
          icon={<Plus size={24} />}
          label="创建房间"
          subLabel="Create New Session"
          primary
        />
        <MenuButton
          onClick={() => setView('join')}
          icon={<Users size={24} />}
          label="加入房间"
          subLabel="Join Existing Session"
        />
        <div className="grid grid-cols-2 gap-4">
          <MenuButton
            onClick={() => setView('workshop')}
            icon={<UploadCloud size={20} />}
            label="创意工坊"
            small
          />
          <MenuButton
            onClick={() => setView('cloud')}
            icon={<Cloud size={20} />}
            label="云存档"
            small
          />
        </div>

        <MenuButton
          onClick={() => setIsSettingsOpen(true)}
          icon={<Settings size={20} />}
          label="系统设置"
          small
        />
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-8 text-zinc-600 text-xs font-mono">
        v1.0.0-Alpha | System Online
      </div>
    </>
  );
}
