import React, { useEffect, useState } from 'react';
import { Check, ListPlus, Trash2, X } from 'lucide-react';
import { Playlist, Track } from '../types/music';
import { getTrackAudioQuality } from '../utils/audioQuality';
import { CoverArt } from './CoverArt';
import { HiResBadge } from './HiResBadge';

interface PlaylistFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'rename';
  initialName?: string;
  initialDescription?: string;
  onClose: () => void;
  onSubmit: (name: string, description: string) => void;
}

export const PlaylistFormModal: React.FC<PlaylistFormModalProps> = ({
  isOpen,
  mode,
  initialName = '',
  initialDescription = '',
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }, [isOpen, initialName, initialDescription]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, description.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-[#1E1E1E] border border-white/10 p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">
            {mode === 'create' ? 'สร้างเพลย์ลิสต์ส่วนตัว' : 'แก้ไขข้อมูลเพลย์ลิสต์'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-[#A7A7A7] hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#A7A7A7] mb-1.5">
              ชื่อเพลย์ลิสต์
            </label>
            <input
              type="text"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น เพลงขับรถตอนกลางคืน"
              className="w-full rounded-xl bg-[#121212] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#1DB954]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#A7A7A7] mb-1.5">
              คำอธิบาย (ไม่บังคับ)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ฟังแบบออฟไลน์ได้ทุกที่"
              className="w-full rounded-xl bg-[#121212] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#1DB954] resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-sm font-semibold text-[#D4D4D4] hover:bg-white/10 transition min-h-[44px]"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-full text-sm font-semibold bg-[#1DB954] hover:bg-[#1ED760] text-black transition min-h-[44px]"
          >
            {mode === 'create' ? 'สร้างเพลย์ลิสต์' : 'บันทึกการแก้ไข'}
          </button>
        </div>
      </form>
    </div>
  );
};

interface AddToPlaylistModalProps {
  track: Track | null;
  playlists: Playlist[];
  onClose: () => void;
  onToggleTrackInPlaylist: (playlistId: string, track: Track) => void;
  onRequestCreatePlaylist: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  track,
  playlists,
  onClose,
  onToggleTrackInPlaylist,
  onRequestCreatePlaylist,
}) => {
  if (!track) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#1E1E1E] border border-white/10 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-3">
            <h3 className="text-lg font-bold text-white">เพิ่มลงในเพลย์ลิสต์</h3>
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <p className="text-xs text-[#A7A7A7] truncate">{track.title}</p>
              {getTrackAudioQuality(track).isHiRes && (
                <HiResBadge size="xs" specLabel={getTrackAudioQuality(track).specLabel} />
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-[#A7A7A7] hover:text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onRequestCreatePlaylist();
          }}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-semibold text-white transition min-h-[48px]"
        >
          <span className="w-9 h-9 rounded-lg bg-[#1DB954]/20 text-[#1ED760] flex items-center justify-center">
            <ListPlus className="w-4 h-4" />
          </span>
          <span>สร้างเพลย์ลิสต์ใหม่</span>
        </button>

        <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
          {playlists.map((pl) => {
            const exists = pl.trackIds.includes(track.id);
            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => onToggleTrackInPlaylist(pl.id, track)}
                className="w-full flex items-center justify-between gap-3 py-3 px-2 hover:bg-white/5 rounded-lg transition min-h-[56px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CoverArt
                    seed={pl.coverSeed}
                    isLikedPlaylist={pl.id === 'liked'}
                    size="xs"
                  />
                  <div className="text-left min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{pl.name}</p>
                    <p className="text-xs text-[#A7A7A7] tabular-nums">
                      {pl.trackIds.length} เพลง
                    </p>
                  </div>
                </div>
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center border transition ${
                    exists
                      ? 'bg-[#1DB954] border-[#1DB954] text-black'
                      : 'border-white/25 text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'ยืนยันการลบ',
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#1E1E1E] border border-white/10 p-6 shadow-2xl space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <p className="text-sm text-[#A7A7A7] mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-full text-sm font-semibold text-[#D4D4D4] hover:bg-white/10 transition min-h-[44px]"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-red-500 hover:bg-red-400 text-white transition min-h-[44px]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
