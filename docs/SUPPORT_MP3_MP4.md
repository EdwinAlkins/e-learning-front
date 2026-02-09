# Support MP3 et MP4 pour le Player

## Analyse de l'architecture actuelle

### État actue

- Le composant `VideoPlayer` utilise **Video.js** avec un type MIME hardcodé `video/mp4`
- L'URL du fichier est construite via : `${API_BASE_URL}/videos/${videoId}/file`
- L'interface `Video` dans `types/index.ts` ne contient pas d'information sur le type de média
- Le player est configuré uniquement pour les vidéos MP4

### Constat technique

- **Video.js** supporte nativement les formats MP3 et MP4
- Le type MIME est actuellement fixé à `video/mp4` dans les options du player
- Aucune détection du type de fichier n'est effectuée côté frontend

---

## Stratégie d'implémentation

### Approche recommandée : Détection côté backend + Frontend

La meilleure approche consiste à :

1. **Backend** : Retourner le type de média dans les métadonnées de la vidéo
2. **Frontend** : Utiliser cette information pour configurer dynamiquement le player

### Alternative : Détection côté frontend uniquement

Si le backend ne peut pas être modifié immédiatement, on peut :

- Faire une requête HEAD sur l'URL du fichier pour récupérer le `Content-Type`
- Ou utiliser l'extension du fichier si disponible dans l'URL
- **Limitation** : Moins fiable et nécessite une requête supplémentaire

---

## Modifications à apporter

### 1. Types TypeScript (`src/types/index.ts`)

**Modification de l'interface `Video` :**

```typescript
export interface Video {
  id: string;
  title: string;
  duration: number;
  mediaType?: 'video' | 'audio'; // Nouveau champ optionnel
  mimeType?: string; // Nouveau champ optionnel (ex: 'video/mp4', 'audio/mpeg')
}
```

**Justification :**

- `mediaType` : Permet de distinguer rapidement audio/vidéo pour l'UI
- `mimeType` : Type MIME exact pour la configuration du player
- Champs optionnels pour rétrocompatibilité

---

### 2. Service API (`src/services/api.ts`)

**Option A - Si le backend retourne déjà le type :**
Aucune modification nécessaire, les types seront automatiquement typés.

**Option B - Si détection côté frontend nécessaire :**
Ajouter une fonction pour détecter le type MIME :

```typescript
// Nouvelle fonction pour détecter le type MIME
getVideoMediaType: async (videoId: string): Promise<{ mediaType: 'video' | 'audio', mimeType: string }> => {
  try {
    const videoUrl = `${API_BASE_URL}/videos/${videoId}/file`;
    const response = await api.head(videoUrl);
    const contentType = response.headers['content-type'] || '';
    
    if (contentType.startsWith('video/')) {
      return { mediaType: 'video', mimeType: contentType };
    } else if (contentType.startsWith('audio/')) {
      return { mediaType: 'audio', mimeType: contentType };
    }
    
    // Fallback : essayer de détecter depuis l'URL
    if (videoUrl.endsWith('.mp4')) {
      return { mediaType: 'video', mimeType: 'video/mp4' };
    } else if (videoUrl.endsWith('.mp3')) {
      return { mediaType: 'audio', mimeType: 'audio/mpeg' };
    }
    
    // Par défaut, considérer comme vidéo
    return { mediaType: 'video', mimeType: 'video/mp4' };
  } catch (error) {
    console.error('Failed to detect media type:', error);
    // Fallback par défaut
    return { mediaType: 'video', mimeType: 'video/mp4' };
  }
}
```

---

### 3. Composant VideoPlayer (`src/components/VideoPlayer.tsx`)

**Modifications principales :**

#### a) Ajouter un prop pour le type de média

```typescript
interface VideoPlayerProps {
  videoId: string;
  mediaType?: 'video' | 'audio'; // Nouveau prop
  mimeType?: string; // Nouveau prop
}
```

#### b) Adapter la configuration Video.js

```typescript
const options = useMemo(
  () => {
    const defaultMimeType = mimeType || 'video/mp4';
    const isAudio = mediaType === 'audio' || defaultMimeType.startsWith('audio/');
    
    return {
      controls: true,
      responsive: true,
      fluid: true,
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      sources: [
        {
          src: videoUrl,
          type: defaultMimeType,
        },
      ],
      // Pour les fichiers audio, désactiver certaines fonctionnalités vidéo
      ...(isAudio && {
        // Video.js gère automatiquement les fichiers audio
        // mais on peut personnaliser l'affichage
      }),
    };
  },
  [videoUrl, mediaType, mimeType]
);
```

#### c) Gestion de l'affichage pour les fichiers audio

Pour les fichiers MP3, Video.js affichera un player audio. Cependant, on peut améliorer l'expérience :

```typescript
// Dans le useEffect d'initialisation
useEffect(() => {
  // ... code existant ...
  
  if (player.current) {
    const isAudio = mediaType === 'audio' || mimeType?.startsWith('audio/');
    
    if (isAudio) {
      // Personnaliser l'affichage pour l'audio
      // Video.js gère automatiquement, mais on peut ajouter des classes CSS
      const playerElement = player.current.el();
      if (playerElement) {
        playerElement.classList.add('vjs-audio-player');
      }
    }
  }
}, [options, mediaType, mimeType, /* autres dépendances */]);
```

---

### 4. Page Player (`src/app/player/[videoId]/page.tsx`)

**Modifications :**

#### a) Récupérer le type de média

```typescript
const [mediaType, setMediaType] = useState<'video' | 'audio' | undefined>();
const [mimeType, setMimeType] = useState<string | undefined>();

// Nouveau useEffect pour détecter le type de média
useEffect(() => {
  if (!videoId) return;
  
  const detectMediaType = async () => {
    // Option 1 : Si le backend retourne le type dans les métadonnées
    if (video?.mediaType && video?.mimeType) {
      setMediaType(video.mediaType);
      setMimeType(video.mimeType);
      return;
    }
    
    // Option 2 : Détection via API
    try {
      const mediaInfo = await apiService.getVideoMediaType(videoId);
      setMediaType(mediaInfo.mediaType);
      setMimeType(mediaInfo.mimeType);
    } catch (error) {
      console.error('Failed to detect media type:', error);
      // Fallback par défaut
      setMediaType('video');
      setMimeType('video/mp4');
    }
  };
  
  detectMediaType();
}, [videoId, video]);
```

#### b) Passer les props au VideoPlayer

```typescript
<VideoPlayer 
  ref={videoPlayerRef} 
  videoId={videoId!}
  mediaType={mediaType}
  mimeType={mimeType}
/>
```

---

### 5. Styles CSS (optionnel)

**Pour améliorer l'affichage des fichiers audio :**

Ajouter dans `src/app/globals.css` ou un fichier CSS dédié :

```css
/* Personnalisation du player audio */
.vjs-audio-player .vjs-poster {
  display: none; /* Pas de poster pour l'audio */
}

.vjs-audio-player .vjs-big-play-button {
  /* Personnaliser le bouton play pour l'audio */
}
```

---

## Modifications des endpoints backend

### Recommandations

#### 1. Endpoint `/formations` (GET)

**Modification suggérée :**

Retourner le type de média dans les métadonnées de chaque vidéo :

```json
{
  "name": "Formation Example",
  "chapters": [
    {
      "name": "Chapitre 1",
      "videos": [
        {
          "id": "video-123",
          "title": "Introduction",
          "duration": 300,
          "media_type": "video",  // Nouveau champ
          "mime_type": "video/mp4"  // Nouveau champ
        },
        {
          "id": "audio-456",
          "title": "Podcast",
          "duration": 600,
          "media_type": "audio",  // Nouveau champ
          "mime_type": "audio/mpeg"  // Nouveau champ
        }
      ]
    }
  ]
}
```

**Avantages :**

- Pas de requête supplémentaire côté frontend
- Information disponible immédiatement
- Plus fiable que la détection côté client

#### 2. Endpoint `/videos/{videoId}/file` (GET)

**Modification suggérée :**

S'assurer que les headers HTTP sont corrects :

- `Content-Type` : Doit refléter le type MIME réel (ex: `video/mp4`, `audio/mpeg`)
- `Content-Disposition` : Peut inclure le nom de fichier avec extension

**Exemple de headers :**

```
Content-Type: video/mp4
Content-Disposition: inline; filename="video.mp4"
```

ou

```
Content-Type: audio/mpeg
Content-Disposition: inline; filename="audio.mp3"
```

**Avantages :**

- Permet la détection côté frontend via HEAD request
- Compatible avec les navigateurs et les players HTML5

#### 3. Nouvel endpoint optionnel : `/videos/{videoId}/metadata` (GET)

**Si on veut séparer les métadonnées du fichier :**

```json
{
  "id": "video-123",
  "title": "Introduction",
  "duration": 300,
  "media_type": "video",
  "mime_type": "video/mp4",
  "file_size": 52428800,
  "resolution": "1920x1080"  // Pour les vidéos uniquement
}
```

**Avantages :**

- Séparation des préoccupations
- Permet de récupérer les métadonnées sans télécharger le fichier
- Plus flexible pour des extensions futures

---

## Plan d'implémentation recommandé

### Phase 1 : Préparation (Backend)

1. ✅ Modifier l'endpoint `/formations` pour inclure `media_type` et `mime_type`
2. ✅ S'assurer que `/videos/{videoId}/file` retourne les bons headers `Content-Type`

### Phase 2 : Frontend - Types

1. ✅ Modifier `src/types/index.ts` pour ajouter les champs optionnels
2. ✅ Mettre à jour les types dans les stores si nécessaire

### Phase 3 : Frontend - Détection

1. ✅ Implémenter la détection du type de média (via API ou HEAD request)
2. ✅ Ajouter la fonction `getVideoMediaType` dans `api.ts` si nécessaire

### Phase 4 : Frontend - Player

1. ✅ Modifier `VideoPlayer` pour accepter `mediaType` et `mimeType`
2. ✅ Adapter la configuration Video.js pour gérer les deux types
3. ✅ Tester avec des fichiers MP3 et MP4

### Phase 5 : UI/UX

1. ✅ Ajouter des styles CSS pour différencier audio/vidéo si nécessaire
2. ✅ Tester l'expérience utilisateur avec les deux types de médias

### Phase 6 : Tests

1. ✅ Tester avec des fichiers MP3
2. ✅ Tester avec des fichiers MP4
3. ✅ Tester la rétrocompatibilité (anciens endpoints sans type)
4. ✅ Tester le fallback en cas d'erreur de détection

---

## Points d'attention

### 1. Rétrocompatibilité

- Les champs `mediaType` et `mimeType` doivent être optionnels
- Prévoir un fallback vers `video/mp4` par défaut
- Ne pas casser les fonctionnalités existantes

### 2. Performance

- Éviter les requêtes HEAD supplémentaires si le backend peut fournir l'info
- Mettre en cache le type de média si possible

### 3. Expérience utilisateur

- Les fichiers audio n'ont pas de visuel vidéo : prévoir une interface adaptée
- Video.js gère bien les deux types, mais l'UI peut être améliorée

### 4. Gestion d'erreurs

- Gérer les cas où la détection échoue
- Avoir un fallback robuste
- Logger les erreurs pour le debugging

---

## Conclusion

L'implémentation du support MP3/MP4 est **techniquement faisable** avec Video.js qui supporte nativement les deux formats. La clé est de :

1. **Détecter le type de média** (idéalement via le backend)
2. **Configurer dynamiquement Video.js** avec le bon type MIME
3. **Adapter l'UI** si nécessaire pour les fichiers audio

Les modifications backend sont **recommandées mais pas strictement nécessaires** si on accepte une détection côté frontend via les headers HTTP.