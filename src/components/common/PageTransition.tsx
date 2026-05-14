import { motion } from 'motion/react';

interface Props {
  viewKey: string;
  children: React.ReactNode;
}

export default function PageTransition({ viewKey, children }: Props) {
  return (
    <motion.div
      key={viewKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        // overflow-y auto so views without an internal scroll container
        // (Settings, Profile, Import, etc.) scroll naturally. Views that DO
        // manage their own scroll (Library, Playlist, Liked, Search, Home)
        // are flex column with bounded children, so they fit perfectly inside
        // and this won't trigger double-scrollbars.
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {children}
    </motion.div>
  );
}
