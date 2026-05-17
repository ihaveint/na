PLAYLISTS = [
    {"id": "chill-vibes", "name": "Chill Vibes", "description": "Lo-fi beats and ambient sounds", "color": "violet", "track_count": 5},
    {"id": "focus-flow", "name": "Focus Flow", "description": "Instrumental tracks for deep work", "color": "blue", "track_count": 5},
    {"id": "energy-boost", "name": "Energy Boost", "description": "High-BPM tracks for working out", "color": "orange", "track_count": 6},
    {"id": "late-night-jazz", "name": "Late Night Jazz", "description": "Smooth jazz and soul for late nights", "color": "emerald", "track_count": 5},
]

TRACKS = [
    # Chill Vibes (bpm 60-85, lo-fi/ambient)
    {"id": "t1", "title": "Midnight Rain", "artist": "Lo-Fi Dreams", "album": "Rain Sessions", "genre": ["lo-fi", "ambient"], "duration_sec": 213, "bpm": 75, "playlist_id": "chill-vibes", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"},
    {"id": "t2", "title": "Coffee Shop", "artist": "Mellow Beats", "album": "Morning Rituals", "genre": ["lo-fi", "jazz"], "duration_sec": 187, "bpm": 82, "playlist_id": "chill-vibes", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"},
    {"id": "t3", "title": "Sunset Waves", "artist": "Coastal Sounds", "album": "Pacific Moods", "genre": ["ambient", "chillout"], "duration_sec": 245, "bpm": 68, "playlist_id": "chill-vibes", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"},
    {"id": "t4", "title": "Rainy Day", "artist": "Lo-Fi Dreams", "album": "Rain Sessions", "genre": ["lo-fi"], "duration_sec": 198, "bpm": 71, "playlist_id": "chill-vibes", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"},
    {"id": "t5", "title": "Night Owl", "artist": "Dreamy Keys", "album": "Insomnia", "genre": ["ambient", "piano"], "duration_sec": 231, "bpm": 64, "playlist_id": "chill-vibes", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3"},
    # Focus Flow (bpm 60-95, instrumental)
    {"id": "t6", "title": "Deep Work", "artist": "Brain Waves", "album": "Productivity", "genre": ["instrumental", "electronic"], "duration_sec": 320, "bpm": 90, "playlist_id": "focus-flow", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3"},
    {"id": "t7", "title": "Flow State", "artist": "Zen Coder", "album": "In The Zone", "genre": ["ambient", "instrumental"], "duration_sec": 278, "bpm": 85, "playlist_id": "focus-flow", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3"},
    {"id": "t8", "title": "Study Hall", "artist": "Quiet Hours", "album": "Library", "genre": ["classical", "piano"], "duration_sec": 195, "bpm": 76, "playlist_id": "focus-flow", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"},
    {"id": "t9", "title": "Algorithm", "artist": "Brain Waves", "album": "Productivity", "genre": ["electronic", "instrumental"], "duration_sec": 244, "bpm": 95, "playlist_id": "focus-flow", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3"},
    {"id": "t10", "title": "Clear Mind", "artist": "Mindful Tones", "album": "Clarity", "genre": ["ambient"], "duration_sec": 301, "bpm": 60, "playlist_id": "focus-flow", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3"},
    # Energy Boost (bpm 120-145, electronic/dance)
    {"id": "t11", "title": "Drop It", "artist": "Bass Factory", "album": "Club Nights", "genre": ["electronic", "dance"], "duration_sec": 223, "bpm": 128, "playlist_id": "energy-boost", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3"},
    {"id": "t12", "title": "Power Hour", "artist": "Electro Rush", "album": "Gym Session", "genre": ["electronic", "edm"], "duration_sec": 198, "bpm": 140, "playlist_id": "energy-boost", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3"},
    {"id": "t13", "title": "Run Faster", "artist": "Tempo Kings", "album": "Marathon", "genre": ["electronic", "dance"], "duration_sec": 214, "bpm": 135, "playlist_id": "energy-boost", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3"},
    {"id": "t14", "title": "Electric Feel", "artist": "Bass Factory", "album": "Club Nights", "genre": ["electronic", "synth"], "duration_sec": 241, "bpm": 122, "playlist_id": "energy-boost", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3"},
    {"id": "t15", "title": "Overdrive", "artist": "Electro Rush", "album": "Gym Session", "genre": ["edm", "hard"], "duration_sec": 187, "bpm": 145, "playlist_id": "energy-boost", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3"},
    {"id": "t16", "title": "Peak Hour", "artist": "City Pulse", "album": "Urban Energy", "genre": ["electronic", "dance"], "duration_sec": 209, "bpm": 130, "playlist_id": "energy-boost", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3"},
    # Late Night Jazz (bpm 70-105, jazz/soul)
    {"id": "t17", "title": "Blue Hour", "artist": "Miles Away", "album": "After Midnight", "genre": ["jazz", "blues"], "duration_sec": 267, "bpm": 72, "playlist_id": "late-night-jazz", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3"},
    {"id": "t18", "title": "Smoky Room", "artist": "The Cool Quartet", "album": "Standards", "genre": ["jazz", "swing"], "duration_sec": 312, "bpm": 88, "playlist_id": "late-night-jazz", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"},
    {"id": "t19", "title": "Whiskey Neat", "artist": "Bourbon Street Band", "album": "New Orleans", "genre": ["jazz", "soul"], "duration_sec": 243, "bpm": 95, "playlist_id": "late-night-jazz", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"},
    {"id": "t20", "title": "Late Call", "artist": "Miles Away", "album": "After Midnight", "genre": ["jazz"], "duration_sec": 289, "bpm": 78, "playlist_id": "late-night-jazz", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"},
    {"id": "t21", "title": "Neon Sax", "artist": "Urban Jazz Project", "album": "City Lights", "genre": ["jazz", "fusion"], "duration_sec": 198, "bpm": 102, "playlist_id": "late-night-jazz", "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"},
]
