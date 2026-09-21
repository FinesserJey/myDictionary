import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'language-lens-dictionary'
const THEME_KEY = 'language-lens-theme'
const RECORDING_DB_NAME = 'language-lens-recordings'
const RECORDING_STORE_NAME = 'recordings'

const initialDictionary = {
  English: [],
  Spanish: [],
  French: [],
  Korean: [],
}

const defaultWordTypes = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'interjection',
  'greeting',
  'phrase',
]

const commonLanguages = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Japanese',
  'Korean',
  'Arabic',
  'Russian',
  'Chinese',
  'Hindi',
]

const libreTranslateEndpoint = 'https://libretranslate.com/translate'
const libreTranslateApiKey = import.meta.env.VITE_LIBRETRANSLATE_API_KEY
const languageCodes = {
  English: 'en',
  Spanish: 'es',
  French: 'fr',
  German: 'de',
  Italian: 'it',
  Portuguese: 'pt',
  Japanese: 'ja',
  Korean: 'ko',
  Arabic: 'ar',
  Russian: 'ru',
  Chinese: 'zh',
  Hindi: 'hi',
}

const formatWordType = (value) => {
  if (!value) {
    return ''
  }

  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

const romanizeKorean = (value) => {
  const initials = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h']
  const vowels = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i']
  const finals = ['', 'k', 'k', 'ks', 'n', 'nj', 'nh', 't', 'l', 'lk', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'p', 'ps', 't', 'ng', 't', 't', 'k', 't', 'p', 'h']

  return [...value].map((character) => {
    const code = character.charCodeAt(0) - 0xac00
    if (code < 0 || code > 11171) return character

    const initialIndex = Math.floor(code / 588)
    const vowelIndex = Math.floor((code % 588) / 28)
    const finalIndex = code % 28
    return `${initials[initialIndex]}${vowels[vowelIndex]}${finals[finalIndex]}`
  }).join('')
}

const emptyForm = {
  word: '',
  translation: '',
  definition: '',
  pronunciation: '',
  voiceRecording: '',
  automaticPronunciation: '',
  romanization: '',
  wordType: '',
  example: '',
  favorite: false,
  tags: '',
  linkedLanguage: '',
  linkedEntryId: '',
}

const openRecordingDatabase = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(RECORDING_DB_NAME, 1)
  request.onupgradeneeded = () => request.result.createObjectStore(RECORDING_STORE_NAME)
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const saveRecording = async (recordingId, blob) => {
  const database = await openRecordingDatabase()
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(RECORDING_STORE_NAME, 'readwrite')
    transaction.objectStore(RECORDING_STORE_NAME).put(blob, recordingId)
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}

const getRecording = async (recordingId) => {
  const database = await openRecordingDatabase()
  const blob = await new Promise((resolve, reject) => {
    const transaction = database.transaction(RECORDING_STORE_NAME, 'readonly')
    const request = transaction.objectStore(RECORDING_STORE_NAME).get(recordingId)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  database.close()
  return blob
}

const deleteRecording = async (recordingId) => {
  if (!recordingId) return
  const database = await openRecordingDatabase()
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(RECORDING_STORE_NAME, 'readwrite')
    transaction.objectStore(RECORDING_STORE_NAME).delete(recordingId)
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}

const recordingToBlob = async (value) => {
  if (!value) return null
  if (value instanceof Blob) return value
  const response = await fetch(value)
  return response.blob()
}

const getStoredDictionary = () => {
  if (typeof window === 'undefined') {
    return initialDictionary
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return initialDictionary
    }

    const parsed = JSON.parse(stored)
    if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
      return parsed
    }
  } catch (error) {
    console.error('Unable to parse saved dictionary', error)
  }

  return initialDictionary
}

function App() {
  const fileInputRef = useRef(null)
  const csvInputRef = useRef(null)
  const libraryMenuRef = useRef(null)
  const settingsRef = useRef(null)
  const touchStartYRef = useRef(null)
  const [languages, setLanguages] = useState(getStoredDictionary)
  const [selectedLanguage, setSelectedLanguage] = useState('English')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWordType, setSelectedWordType] = useState('')
  const [formData, setFormData] = useState(emptyForm)
  const [translationSource, setTranslationSource] = useState('English')
  const [translationTarget, setTranslationTarget] = useState('Spanish')
  const [customWordTypes, setCustomWordTypes] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [isLookingUpWord, setIsLookingUpWord] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingError, setRecordingError] = useState('')
  const mediaRecorderRef = useRef(null)
  const recordingStreamRef = useRef(null)
  const [draggedLanguage, setDraggedLanguage] = useState(null)
  const draggedLanguageRef = useRef(null)
  const pointerStartRef = useRef(null)
  const dragMovedRef = useRef(false)
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState(null)
  const [studyMode, setStudyMode] = useState(false)
  const [studyIndex, setStudyIndex] = useState(0)
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false)
  const [revealAnswer, setRevealAnswer] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    const storedTheme = localStorage.getItem(THEME_KEY)
    if (storedTheme) {
      return storedTheme === 'dark'
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [activeTab, setActiveTab] = useState('browse')
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [openEntryMenuId, setOpenEntryMenuId] = useState(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedEntryIds, setSelectedEntryIds] = useState([])
  const [expandedEntryId, setExpandedEntryId] = useState(null)
  const [recordingUrls, setRecordingUrls] = useState({})
  const [selectedTag, setSelectedTag] = useState('')
  const [studyModeType, setStudyModeType] = useState('flashcard')
  const [studyTag, setStudyTag] = useState('')
  const [studyAnswer, setStudyAnswer] = useState('')
  const [studyFeedback, setStudyFeedback] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(languages))
  }, [languages])

  useEffect(() => {
    localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    if (!languages[selectedLanguage]) {
      const firstLanguage = Object.keys(languages)[0]
      if (firstLanguage) {
        setSelectedLanguage(firstLanguage)
      }
    }
  }, [languages, selectedLanguage])

  useEffect(() => {
    setRevealAnswer(false)
  }, [selectedLanguage, studyMode])

  useEffect(() => {
    setSelectedEntryIds([])
    setSelectionMode(false)
    setOpenEntryMenuId(null)
    setIsFlashcardFlipped(false)
  }, [selectedLanguage])

  useEffect(() => {
    if (!quickAddOpen) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      document.getElementById('entry-word-input')?.focus()
    }, 120)

    return () => window.clearTimeout(timer)
  }, [quickAddOpen])

  useEffect(() => {
    if (!languageMenuOpen) {
      return undefined
    }

    const handleOutsideClick = (event) => {
      if (!libraryMenuRef.current?.contains(event.target)) {
        setLanguageMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleOutsideClick)
    return () => document.removeEventListener('pointerdown', handleOutsideClick)
  }, [languageMenuOpen])

  useEffect(() => {
    if (!settingsOpen) {
      return undefined
    }

    const handleOutsideClick = (event) => {
      if (!settingsRef.current?.contains(event.target)) {
        setSettingsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleOutsideClick)
    return () => document.removeEventListener('pointerdown', handleOutsideClick)
  }, [settingsOpen])

  const availableLanguages = Object.keys(languages)

  const currentEntries = languages[selectedLanguage] || []
  const wordTypeOptions = [...defaultWordTypes, ...customWordTypes]
  const allTags = useMemo(
    () => [...new Set(Object.values(languages).flat().flatMap((entry) => Array.isArray(entry.tags) ? entry.tags : []))].sort(),
    [languages],
  )

  useEffect(() => {
    let cancelled = false
    const loadRecordings = async () => {
      const loaded = {}
      await Promise.all(currentEntries.map(async (entry) => {
        if (!entry.voiceRecordingId) return
        try {
          const blob = await getRecording(entry.voiceRecordingId)
          if (blob) loaded[entry.voiceRecordingId] = URL.createObjectURL(blob)
        } catch (error) {
          console.warn('Unable to load saved recording', error)
        }
      }))
      if (!cancelled) setRecordingUrls(loaded)
      else Object.values(loaded).forEach((url) => URL.revokeObjectURL(url))
    }
    loadRecordings()
    return () => {
      cancelled = true
      Object.values(recordingUrls).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [currentEntries])

  const favoriteEntries = useMemo(
    () => currentEntries.filter((entry) => entry.favorite),
    [currentEntries],
  )

  const studyEntries = useMemo(
    () => (favoriteEntries.length > 0 ? favoriteEntries : currentEntries),
    [currentEntries, favoriteEntries],
  )

  const filteredEntries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const entries = activeTab === 'favorites' ? currentEntries.filter((entry) => entry.favorite) : currentEntries
    const groupedEntries = selectedWordType ? entries.filter((entry) => entry.wordType === selectedWordType) : entries
    const taggedEntries = selectedTag ? groupedEntries.filter((entry) => entry.tags?.includes(selectedTag)) : groupedEntries

    if (!query) {
      return taggedEntries
    }

    return taggedEntries.filter((entry) =>
      [entry.word, entry.translation, entry.definition, entry.pronunciation, entry.automaticPronunciation, entry.romanization, entry.example]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [activeTab, currentEntries, searchTerm, selectedTag, selectedWordType])

  const filteredStudyEntries = useMemo(() => {
    if (!studyTag) return studyEntries
    return studyEntries.filter((entry) => entry.tags?.includes(studyTag))
  }, [studyEntries, studyTag])

  const currentStudyCard = filteredStudyEntries[studyIndex % Math.max(filteredStudyEntries.length, 1)] || null

  const resetForm = () => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaRecorderRef.current = null
    recordingStreamRef.current = null
    setIsRecording(false)
    setRecordingError('')
    setFormData(emptyForm)
    setEditingEntryId(null)
  }

  const applyDictionaryResult = (result) => {
    const meaning = result.meanings?.[0]
    const definition = meaning?.definitions?.[0]
    const phonetic = result.phonetic || result.phonetics?.find((item) => item.text)?.text || ''

    setFormData((current) => ({
      ...current,
      word: result.word || current.word,
      definition: definition?.definition || current.definition,
      wordType: formatWordType(meaning?.partOfSpeech || current.wordType),
      automaticPronunciation: phonetic,
    }))
  }

  const lookupWord = async (word) => {
    const cleanedWord = word.trim()
    if (!cleanedWord || selectedLanguage !== 'English') return

    setIsLookingUpWord(true)
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanedWord)}`)
      if (response.ok) {
        const results = await response.json()
        applyDictionaryResult(results[0])
      }
    } catch (error) {
      console.warn('Dictionary lookup unavailable', error)
    } finally {
      setIsLookingUpWord(false)
    }
  }

  const translateWord = async () => {
    const word = formData.word.trim()
    const sourceLanguage = languageCodes[translationSource]
    const targetLanguage = languageCodes[translationTarget]
    if (!word || !sourceLanguage || !targetLanguage || sourceLanguage === targetLanguage) return

    setIsTranslating(true)
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: word, source: sourceLanguage, target: targetLanguage, format: 'text' }),
      })

      if (!response.ok) {
        throw new Error(`Translation failed with status ${response.status}`)
      }

      const result = await response.json()
      const translatedText = result.translatedText
      if (translatedText) {
        setFormData((current) => ({ ...current, translation: translatedText }))
      }
    } catch (error) {
      console.warn('Translation proxy unavailable', error)
    } finally {
      setIsTranslating(false)
    }
  }

  const speakWord = (word, language) => {
    if (!('speechSynthesis' in window) || !word) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = languageCodes[language] || 'en'
    window.speechSynthesis.speak(utterance)
  }

  const toggleVoiceRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingError('Voice recording is not supported in this browser.')
      return
    }

    try {
      setRecordingError('')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onstop = () => {
        const reader = new FileReader()
        reader.onloadend = () => {
          setFormData((current) => ({ ...current, voiceRecording: reader.result }))
        }
        reader.readAsDataURL(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
        stream.getTracks().forEach((track) => track.stop())
        mediaRecorderRef.current = null
        recordingStreamRef.current = null
        setIsRecording(false)
      }

      mediaRecorderRef.current = recorder
      recordingStreamRef.current = stream
      recorder.start()
      setIsRecording(true)
    } catch (error) {
      setRecordingError(error.name === 'NotAllowedError' ? 'Microphone access was denied.' : 'Unable to start recording.')
    }
  }

  useEffect(() => {
    const cleanedWord = formData.word.trim()
    if (!cleanedWord || selectedLanguage !== 'English' || editingEntryId !== null) {
      setSuggestions([])
      return undefined
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(cleanedWord)}*&max=6`, {
          signal: controller.signal,
        })
        if (response.ok) {
          const results = await response.json()
          setSuggestions(results.map((result) => result.word).filter(Boolean))
        }
      } catch (error) {
        if (error.name !== 'AbortError') console.warn('Autocomplete unavailable', error)
      }
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [editingEntryId, formData.word, selectedLanguage])

  const handleLanguageSelect = (nextValue) => {
    if (nextValue === '__add_new__') {
      const customLanguage = window.prompt('Enter a new language name:')
      if (!customLanguage) {
        return
      }

      const normalizedName = customLanguage
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')

      if (!normalizedName) return

      if (!languages[normalizedName]) {
        setLanguages((current) => ({
          ...current,
          [normalizedName]: [],
        }))
      }

      setSelectedLanguage(normalizedName)
      if (languageCodes[normalizedName]) {
        setTranslationSource(normalizedName)
        setTranslationTarget(normalizedName === 'English' ? 'Spanish' : 'English')
      }
      setLanguageMenuOpen(false)
      return
    }

    setSelectedLanguage(nextValue)
    if (languageCodes[nextValue]) {
      setTranslationSource(nextValue)
      setTranslationTarget(nextValue === 'English' ? 'Spanish' : 'English')
    }
    setLanguageMenuOpen(false)
  }

  const handleLanguageDrop = (targetLanguage, sourceLanguage = draggedLanguageRef.current) => {
    if (!sourceLanguage || sourceLanguage === targetLanguage) {
      return
    }

    const reorderedLanguages = availableLanguages.filter((language) => language !== sourceLanguage)
    const targetIndex = reorderedLanguages.indexOf(targetLanguage)
    reorderedLanguages.splice(targetIndex, 0, sourceLanguage)

    setLanguages((current) =>
      Object.fromEntries(reorderedLanguages.map((language) => [language, current[language]])),
    )
    setDraggedLanguage(null)
  }

  const handleLanguagePointerDown = (event, language) => {
    if (event.pointerType === 'mouse') return

    pointerStartRef.current = { x: event.clientX, y: event.clientY }
    dragMovedRef.current = false
    draggedLanguageRef.current = language
    setDraggedLanguage(language)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handleLanguagePointerMove = (event) => {
    if (event.pointerType === 'mouse') return

    if (!pointerStartRef.current || !draggedLanguageRef.current) return

    const distance = Math.hypot(
      event.clientX - pointerStartRef.current.x,
      event.clientY - pointerStartRef.current.y,
    )
    if (distance > 6) {
      dragMovedRef.current = true
    }

    if (dragMovedRef.current) {
      const row = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-language-row]')
      const targetLanguage = row?.getAttribute('data-language-row')
      if (targetLanguage) {
        handleLanguageDrop(targetLanguage, draggedLanguageRef.current)
      }
    }
  }

  const handleLanguagePointerEnter = (language) => {
    if (dragMovedRef.current && draggedLanguageRef.current) {
      handleLanguageDrop(language, draggedLanguageRef.current)
    }
  }

  const handleLanguagePointerUp = (event) => {
    if (event.pointerType === 'mouse') return

    event.currentTarget.releasePointerCapture?.(event.pointerId)
    pointerStartRef.current = null
    draggedLanguageRef.current = null
    setDraggedLanguage(null)
  }

  const handleLanguageDragStart = (event, language) => {
    draggedLanguageRef.current = language
    setDraggedLanguage(language)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', language)
  }

  const handleLanguageDragOver = (event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleLanguageDragEnd = () => {
    draggedLanguageRef.current = null
    setDraggedLanguage(null)
  }

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target

    if (name === 'word') {
      setFormData((current) => ({
        ...current,
        word: value,
        romanization: selectedLanguage === 'Korean' ? romanizeKorean(value) : current.romanization,
      }))
      return
    }

    if (name === 'wordType' && value === '__add_new__') {
      const customWordType = window.prompt('Enter a new word type:')
      const formattedWordType = formatWordType(customWordType || '')

      if (formattedWordType) {
        setCustomWordTypes((current) =>
          current.includes(formattedWordType) ? current : [...current, formattedWordType],
        )
        setFormData((current) => ({ ...current, wordType: formattedWordType }))
      }

      return
    }

    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const previousEntry = editingEntryId === null
      ? null
      : (languages[selectedLanguage] || []).find((entry) => entry.id === editingEntryId)
    const voiceRecordingId = formData.voiceRecording
      ? (previousEntry?.voiceRecordingId || `recording-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      : previousEntry?.voiceRecordingId || ''
    if (formData.voiceRecording) {
      try {
        const recordingBlob = await recordingToBlob(formData.voiceRecording)
        await saveRecording(voiceRecordingId, recordingBlob)
      } catch (error) {
        console.warn('Unable to save recording in IndexedDB', error)
      }
    }

    const normalizedEntry = {
      ...formData,
      word: formData.word.trim(),
      translation: formData.translation.trim(),
      definition: formData.definition.trim(),
      pronunciation: formData.pronunciation.trim(),
      voiceRecording: previousEntry?.voiceRecording && !formData.voiceRecording ? previousEntry.voiceRecording : '',
      voiceRecordingId,
      automaticPronunciation: formData.automaticPronunciation.trim(),
      romanization: formData.romanization.trim(),
      example: formData.example.trim(),
      wordType: formData.wordType,
      favorite: Boolean(formData.favorite),
      tags: formData.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      linkedEntries: formData.linkedLanguage && formData.linkedEntryId
        ? [{ language: formData.linkedLanguage, entryId: Number(formData.linkedEntryId) }]
        : previousEntry?.linkedEntries || [],
    }

    if (!normalizedEntry.word) {
      return
    }

    const identicalWordExists = (currentEntriesForLanguage = []) =>
      currentEntriesForLanguage.some((entry) => (
        entry.id !== editingEntryId &&
        typeof entry.word === 'string' &&
        entry.word.trim().toLowerCase() === normalizedEntry.word.toLowerCase()
      ))

    const hasDuplicate = (() => {
      const currentEntriesForLanguage = languages[selectedLanguage] || []
      return identicalWordExists(currentEntriesForLanguage)
    })()

    if (hasDuplicate) {
      window.alert(`"${normalizedEntry.word}" already exists in ${selectedLanguage}. Choose a different term or edit the existing entry.`)
      return
    }

    setLanguages((current) => {
      const currentEntriesForLanguage = current[selectedLanguage] || []

      const nextEntries =
        editingEntryId === null
          ? [{ id: Date.now(), ...normalizedEntry }, ...currentEntriesForLanguage]
          : currentEntriesForLanguage.map((entry) =>
              entry.id === editingEntryId ? { ...entry, ...normalizedEntry } : entry,
            )

      return {
        ...current,
        [selectedLanguage]: nextEntries,
      }
    })

    setQuickAddOpen(false)
    resetForm()
  }

  const handleEdit = (entry) => {
    setQuickAddOpen(true)
    setEditingEntryId(entry.id)
    setFormData({
      word: entry.word,
      translation: entry.translation,
      definition: entry.definition,
      pronunciation: entry.pronunciation,
      voiceRecording: entry.voiceRecording || '',
      automaticPronunciation: entry.automaticPronunciation || '',
      romanization: entry.romanization || '',
      wordType: entry.wordType,
      example: entry.example,
      favorite: Boolean(entry.favorite),
      tags: (entry.tags || []).join(', '),
      linkedLanguage: entry.linkedEntries?.[0]?.language || '',
      linkedEntryId: entry.linkedEntries?.[0]?.entryId?.toString() || '',
    })
  }

  const handleDelete = (entryId) => {
    const deletedEntry = currentEntries.find((entry) => entry.id === entryId)
    if (deletedEntry?.voiceRecordingId) deleteRecording(deletedEntry.voiceRecordingId).catch(() => {})
    setLanguages((current) => ({
      ...current,
      [selectedLanguage]: (current[selectedLanguage] || []).filter((entry) => entry.id !== entryId),
    }))

    if (editingEntryId === entryId) {
      resetForm()
    }

    setOpenEntryMenuId(null)
  }

  const toggleEntrySelection = (entryId) => {
    setSelectedEntryIds((current) =>
      current.includes(entryId) ? current.filter((id) => id !== entryId) : [...current, entryId],
    )
  }

  const handleDeleteSelected = () => {
    if (selectedEntryIds.length === 0) return

    const confirmed = window.confirm(`Delete ${selectedEntryIds.length} selected ${selectedEntryIds.length === 1 ? 'word' : 'words'}?`)
    if (!confirmed) return

    setLanguages((current) => ({
      ...current,
      [selectedLanguage]: (current[selectedLanguage] || []).filter((entry) => !selectedEntryIds.includes(entry.id)),
    }))
    if (editingEntryId !== null && selectedEntryIds.includes(editingEntryId)) {
      resetForm()
    }
    setSelectedEntryIds([])
    setSelectionMode(false)
  }

  const toggleFavorite = (entryId) => {
    setLanguages((current) => ({
      ...current,
      [selectedLanguage]: (current[selectedLanguage] || []).map((entry) =>
        entry.id === entryId ? { ...entry, favorite: !entry.favorite } : entry,
      ),
    }))
  }

  const handleDeleteLibrary = (language) => {
    const entryCount = (languages[language] || []).length
    const confirmed = window.confirm(`Delete the ${language} library and all ${entryCount} saved ${entryCount === 1 ? 'entry' : 'entries'}? This cannot be undone.`)
    if (!confirmed) return

    const remainingLanguages = Object.fromEntries(Object.entries(languages).filter(([name]) => name !== language))
    if (Object.keys(remainingLanguages).length === 0) {
      window.alert('Keep at least one language library.')
      return
    }
    setLanguages(remainingLanguages)
    setSelectedLanguage(Object.keys(remainingLanguages)[0])
    setLanguageMenuOpen(false)
  }

  const handleExport = () => {
    const exportData = selectedEntryIds.length > 0
      ? { [selectedLanguage]: currentEntries.filter((entry) => selectedEntryIds.includes(entry.id)) }
      : languages
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = selectedEntryIds.length > 0 ? 'dictionary-selection.json' : 'dictionary-export.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const csvEscape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCSV = () => {
    const entries = selectedEntryIds.length > 0
      ? currentEntries.filter((entry) => selectedEntryIds.includes(entry.id))
      : currentEntries
    const headers = ['language', 'word', 'translation', 'definition', 'pronunciation', 'automaticPronunciation', 'romanization', 'wordType', 'example', 'favorite', 'tags']
    const rows = entries.map((entry) => [selectedLanguage, entry.word, entry.translation, entry.definition, entry.pronunciation, entry.automaticPronunciation, entry.romanization, entry.wordType, entry.example, entry.favorite, (entry.tags || []).join('|')])
    downloadFile([headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n'), 'dictionary-export.csv', 'text/csv')
  }

  const parseCsvRow = (row) => {
    const values = []
    let value = ''
    let quoted = false
    for (let index = 0; index < row.length; index += 1) {
      const character = row[index]
      if (character === '"' && row[index + 1] === '"') {
        value += '"'
        index += 1
      } else if (character === '"') {
        quoted = !quoted
      } else if (character === ',' && !quoted) {
        values.push(value)
        value = ''
      } else {
        value += character
      }
    }
    values.push(value)
    return values
  }

  const handleImportCSV = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const rows = file.text ? (await file.text()).split(/\r?\n/).filter(Boolean).map(parseCsvRow) : []
      const headers = rows.shift()?.map((header) => header.replace(/^"|"$/g, '')) || []
      const imported = rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])))
      const nextEntries = imported.filter((entry) => entry.word?.trim()).map((entry) => ({
        id: Date.now() + Math.random(),
        word: entry.word.trim(),
        translation: entry.translation || '',
        definition: entry.definition || '',
        pronunciation: entry.pronunciation || '',
        automaticPronunciation: entry.automaticPronunciation || '',
        romanization: entry.romanization || '',
        wordType: entry.wordType || '',
        example: entry.example || '',
        favorite: entry.favorite === 'true',
        tags: (entry.tags || '').split('|').map((tag) => tag.trim()).filter(Boolean),
      }))
      if (nextEntries.length === 0) throw new Error('No valid entries found.')
      const language = imported[0]?.language?.trim() || selectedLanguage
      setLanguages((current) => ({ ...current, [language]: [...nextEntries, ...(current[language] || [])] }))
      setSelectedLanguage(language)
    } catch (error) {
      console.error('CSV import failed', error)
      window.alert('Unable to import that CSV file.')
    } finally {
      event.target.value = ''
    }
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const importedText = await file.text()
      const parsedData = JSON.parse(importedText)

      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error('Invalid dictionary file.')
      }

      const normalized = Object.fromEntries(
        Object.entries(parsedData)
          .filter(([language]) => typeof language === 'string' && language.trim())
          .map(([language, entries]) => [
            language,
            Array.isArray(entries)
              ? entries
                  .filter((entry) => entry && typeof entry === 'object' && typeof entry.word === 'string')
                  .map((entry) => ({
                    ...entry,
                    id: Number(entry.id) || Date.now() + Math.random(),
                    word: entry.word.trim(),
                    translation: typeof entry.translation === 'string' ? entry.translation : '',
                    definition: typeof entry.definition === 'string' ? entry.definition : '',
                    pronunciation: typeof entry.pronunciation === 'string' ? entry.pronunciation : '',
                    voiceRecording: typeof entry.voiceRecording === 'string' ? entry.voiceRecording : '',
                    voiceRecordingId: typeof entry.voiceRecordingId === 'string' ? entry.voiceRecordingId : '',
                    automaticPronunciation: typeof entry.automaticPronunciation === 'string' ? entry.automaticPronunciation : '',
                    romanization: typeof entry.romanization === 'string' ? entry.romanization : '',
                    example: typeof entry.example === 'string' ? entry.example : '',
                    favorite: Boolean(entry.favorite),
                    tags: Array.isArray(entry.tags) ? entry.tags.filter((tag) => typeof tag === 'string') : [],
                    linkedEntries: Array.isArray(entry.linkedEntries) ? entry.linkedEntries : [],
                  }))
              : [],
          ]),
      )

      setLanguages(normalized)
      if (Object.keys(normalized).length > 0) {
        setSelectedLanguage(Object.keys(normalized)[0])
      }
    } catch (error) {
      console.error('Import failed', error)
      window.alert('Unable to import that file. Please use a valid dictionary export JSON.')
    } finally {
      event.target.value = ''
    }
  }

  const handleTouchStart = (event) => {
    if (window.scrollY > 0) {
      return
    }

    touchStartYRef.current = event.touches[0].clientY
  }

  const handleTouchMove = (event) => {
    if (touchStartYRef.current === null || window.scrollY > 0) {
      return
    }

    const delta = event.touches[0].clientY - touchStartYRef.current
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.6, 120))
    }
  }

  const handleTouchEnd = () => {
    if (pullDistance > 70) {
      setIsRefreshing(true)
      setSearchTerm('')
      setTimeout(() => {
        setIsRefreshing(false)
        setPullDistance(0)
      }, 700)
    } else {
      setPullDistance(0)
    }

    touchStartYRef.current = null
  }

  return (
    <div className="app-shell" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">Dictionary studio</p>
          <h1>Language Lens</h1>
        </div>

        <div className="toolbar">
          <label className="search-field">
            <span>Search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder=""
            />
          </label>

        </div>
        <button
          type="button"
          className="theme-icon-button"
          onClick={() => setDarkMode((current) => !current)}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span aria-hidden="true">{darkMode ? '\u2600' : '\u263e'}</span>
        </button>
        <div className="mobile-settings" ref={settingsRef}>
          <button
            type="button"
            className="settings-button"
            aria-label="Open settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((current) => !current)}
          >
            <span aria-hidden="true">&#9776;</span>
          </button>
          {settingsOpen && (
            <div className="settings-menu">
              <button type="button" onClick={handleExport}>Export JSON</button>
              <button type="button" onClick={() => fileInputRef.current?.click()}>Import JSON</button>
              <button type="button" onClick={handleExportCSV}>Export CSV</button>
              <button type="button" onClick={() => csvInputRef.current?.click()}>Import CSV</button>
            </div>
          )}
        </div>
      </header>

      <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImport} />
      <input ref={csvInputRef} type="file" accept="text/csv,.csv" hidden onChange={handleImportCSV} />

      <div className={`pull-indicator ${isRefreshing ? 'refreshing' : ''}`} style={{ height: `${Math.max(pullDistance, 0)}px` }}>
        <span>{isRefreshing ? 'Refreshing...' : pullDistance > 70 ? 'Release to refresh' : 'Pull to refresh'}</span>
      </div>

      <main className="content">
        {quickAddOpen && (
          <aside className="panel form-panel">
            <div className="section-head">
              <h2>{editingEntryId !== null ? 'Edit word' : 'Add a new word'}</h2>
            </div>

            <form className="entry-form" onSubmit={handleSubmit}>
              <label>
                <span>New Term</span>
                <input
                  id="entry-word-input"
                  type="text"
                  name="word"
                  value={formData.word}
                  onChange={handleFormChange}
                  onBlur={() => lookupWord(formData.word)}
                  placeholder=""
                />
                {suggestions.length > 0 && (
                  <div className="word-suggestions" role="listbox" aria-label="Word suggestions">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setFormData((current) => ({ ...current, word: suggestion }))
                          setSuggestions([])
                          lookupWord(suggestion)
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                {isLookingUpWord && <span className="lookup-status">Looking up definition...</span>}
              </label>

              <label>
                <span>Translation direction</span>
                <div className="translation-direction-row">
                  <select value={translationSource} onChange={(event) => setTranslationSource(event.target.value)}>
                    {commonLanguages.filter((language) => languageCodes[language]).map((language) => <option key={language}>{language}</option>)}
                  </select>
                  <button type="button" className="inline-action-button" onClick={() => { setTranslationSource(translationTarget); setTranslationTarget(translationSource) }} aria-label="Swap translation direction">&#8646;</button>
                  <select value={translationTarget} onChange={(event) => setTranslationTarget(event.target.value)}>
                    {commonLanguages.filter((language) => languageCodes[language]).map((language) => <option key={language}>{language}</option>)}
                  </select>
                </div>
              </label>

              <label>
                <span>Translation</span>
                <div className="translation-input-row">
                  <input
                    type="text"
                    name="translation"
                    value={formData.translation}
                    onChange={handleFormChange}
                    placeholder=""
                  />
                  <button
                    type="button"
                    className="inline-action-button"
                    onClick={translateWord}
                    disabled={isTranslating || !languageCodes[translationSource] || !languageCodes[translationTarget] || translationSource === translationTarget}
                  >
                    {isTranslating ? '...' : 'Translate'}
                  </button>
                </div>
              </label>

              <label>
                <span>Definition</span>
                <textarea
                  name="definition"
                  value={formData.definition}
                  onChange={handleFormChange}
                  placeholder=""
                  rows="3"
                />
              </label>

              <label>
                <span>Your Pronunciation</span>
                <div className="voice-recording-controls">
                  <button type="button" className="inline-action-button" onClick={toggleVoiceRecording}>
                    {isRecording ? 'Stop recording' : 'Record voice'}
                  </button>
                  {formData.voiceRecording && (
                    <audio controls src={formData.voiceRecording} aria-label="Your recorded pronunciation" />
                  )}
                </div>
                {recordingError && <span className="form-help error-text">{recordingError}</span>}
              </label>

              <label>
                <span>Automatic Pronunciation</span>
                <div className="translation-input-row">
                  <input
                    type="text"
                    value={formData.automaticPronunciation}
                    readOnly
                  />
                  <button
                    type="button"
                    className="inline-action-button"
                    onClick={() => lookupWord(formData.word)}
                    disabled={!formData.word}
                    aria-label="Look up pronunciation"
                  >
                    Lookup
                  </button>
                </div>
              </label>

              {selectedLanguage === 'Korean' && formData.romanization && (
                <label>
                  <span>Romanization</span>
                  <input type="text" value={formData.romanization} readOnly />
                </label>
              )}

              <label>
                <span>Word Type</span>
                <select
                  name="wordType"
                  value={formData.wordType}
                  onChange={handleFormChange}
                >
                  <option value="">Select a Word Type</option>
                  {wordTypeOptions.map((type) => (
                    <option key={type} value={formatWordType(type)}>
                      {formatWordType(type)}
                    </option>
                  ))}
                  <option value="__add_new__">+ Add new word type</option>
                </select>
              </label>

              <label>
                <span>Example</span>
                <textarea
                  name="example"
                  value={formData.example}
                  onChange={handleFormChange}
                  placeholder=""
                  rows="3"
                />
              </label>

              <label>
                <span>Tags</span>
                <input type="text" name="tags" value={formData.tags} onChange={handleFormChange} placeholder="travel, beginner" />
              </label>

              <label>
                <span>Link to another language</span>
                <div className="translation-direction-row">
                  <select name="linkedLanguage" value={formData.linkedLanguage} onChange={handleFormChange}>
                    <option value="">No linked entry</option>
                    {availableLanguages.filter((language) => language !== selectedLanguage).map((language) => <option key={language}>{language}</option>)}
                  </select>
                  <select name="linkedEntryId" value={formData.linkedEntryId} onChange={handleFormChange} disabled={!formData.linkedLanguage}>
                    <option value="">Choose a word</option>
                    {(languages[formData.linkedLanguage] || []).map((entry) => <option key={entry.id} value={entry.id}>{entry.word}</option>)}
                  </select>
                </div>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="favorite"
                  checked={formData.favorite}
                  onChange={handleFormChange}
                />
                <span>Save as favorite for flashcards</span>
              </label>

              <div className="form-actions">
                <button className="submit-button" type="submit">
                  {editingEntryId !== null ? 'Update entry' : 'Save entry'}
                </button>
                <button type="button" className="cancel-button" onClick={() => { setQuickAddOpen(false); resetForm() }}>
                  Cancel
                </button>
              </div>
            </form>
          </aside>
        )}

        <section className="panel entries-panel">
          <div className="section-head">
            <div className="library-tab" ref={libraryMenuRef}>
              <button
                type="button"
                className="library-tab-trigger"
                aria-expanded={languageMenuOpen}
                onClick={() => setLanguageMenuOpen((current) => !current)}
              >
                <h2>{selectedLanguage} Library</h2>
                <span aria-hidden="true">{languageMenuOpen ? '\u25b2' : '\u25bc'}</span>
              </button>
              {languageMenuOpen && (
                <div className="library-language-menu language-order-list" role="listbox" aria-label="Reorder languages">
                  {availableLanguages.map((language) => (
                    <div
                      key={language}
                      data-language-row={language}
                      className={`language-order-item ${language === selectedLanguage ? 'is-selected' : ''}`}
                      draggable
                      onDragStart={(event) => handleLanguageDragStart(event, language)}
                      onDragOver={handleLanguageDragOver}
                      onDrop={(event) => {
                        event.preventDefault()
                        handleLanguageDrop(language, draggedLanguageRef.current || event.dataTransfer.getData('text/plain'))
                      }}
                      onDragEnd={handleLanguageDragEnd}
                      onPointerDown={(event) => handleLanguagePointerDown(event, language)}
                      onPointerMove={handleLanguagePointerMove}
                      onPointerEnter={() => handleLanguagePointerEnter(language)}
                      onPointerUp={handleLanguagePointerUp}
                    >
                      <button
                        type="button"
                        className="language-order-select"
                        onClick={() => {
                          if (dragMovedRef.current) {
                            dragMovedRef.current = false
                            return
                          }
                          handleLanguageSelect(language)
                        }}
                      >
                        <span aria-hidden="true">&#8942;&#8942;</span>
                        {language}
                      </button>
                    </div>
                  ))}
                  <button type="button" className="language-order-item add-language-item" onClick={() => handleLanguageSelect('__add_new__')}>
                    + Add new language
                  </button>
                  <button type="button" className="language-order-item delete-language-item" onClick={() => handleDeleteLibrary(selectedLanguage)}>
                    Delete {selectedLanguage} library
                  </button>
                </div>
              )}
            </div>
            <div className="library-actions">
              <span>{filteredEntries.length} words</span>
              <select
                className="word-type-filter"
                value={selectedWordType}
                onChange={(event) => setSelectedWordType(event.target.value)}
                aria-label="Filter by word type"
              >
                <option value="">Filter</option>
                {wordTypeOptions.map((type) => (
                  <option key={type} value={formatWordType(type)}>{formatWordType(type)}</option>
                ))}
              </select>
              <select className="word-type-filter" value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)} aria-label="Filter by tag">
                <option value="">All tags</option>
                {allTags.map((tag) => <option key={tag}>{tag}</option>)}
              </select>
              <button
                type="button"
                className={`select-entries-button ${selectionMode ? 'is-active' : ''}`}
                onClick={() => {
                  setSelectionMode((current) => !current)
                  setSelectedEntryIds([])
                }}
              >
                {selectionMode ? 'Cancel' : 'Select'}
              </button>
              {selectionMode && (
                <button
                  type="button"
                  className="bulk-delete-button"
                  onClick={handleDeleteSelected}
                  disabled={selectedEntryIds.length === 0}
                >
                  Delete Selected ({selectedEntryIds.length})
                </button>
              )}
              <button type="button" className="select-entries-button" onClick={handleExportCSV}>
                Export CSV{selectedEntryIds.length > 0 ? ' selected' : ''}
              </button>
            </div>
          </div>

          <div className="mobile-search-wrapper">
            <label className="mobile-search-field">
              <span>Search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder=""
              />
            </label>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="empty-state">
              <p>No terms in this language library yet.</p>
            </div>
          ) : (
            <div className="entries-list">
              {filteredEntries.map((entry) => {
                const isExpanded = expandedEntryId === entry.id

                return (
                  <article
                    key={entry.id}
                    className={`entry-card ${isExpanded ? 'is-expanded' : ''}`}
                    onClick={(event) => {
                      if (event.target.closest('button, input, textarea, select, audio, label')) {
                        return
                      }

                      setExpandedEntryId((current) => (current === entry.id ? null : entry.id))
                    }}
                  >
                    {selectionMode && (
                      <label className="entry-selection">
                        <input
                          type="checkbox"
                          checked={selectedEntryIds.includes(entry.id)}
                          onChange={() => toggleEntrySelection(entry.id)}
                        />
                      </label>
                    )}
                    <div className="entry-header">
                      <div className="entry-title-group">
                        <button
                          type="button"
                          className="entry-word-button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setExpandedEntryId((current) => (current === entry.id ? null : entry.id))
                          }}
                        >
                          <span>{entry.word}</span>
                        </button>
                        <button
                          type="button"
                          className="mic-button"
                          aria-label={`Play pronunciation for ${entry.word}`}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            speakWord(entry.pronunciation || entry.automaticPronunciation || entry.word, selectedLanguage)
                          }}
                        >
                          🎙️
                        </button>
                      </div>
                      <div className="entry-tools">
                        <button
                          type="button"
                          className={`favorite-toggle ${entry.favorite ? 'is-favorite' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleFavorite(entry.id)
                          }}
                          aria-label={entry.favorite ? 'Remove favorite' : 'Add favorite'}
                        >
                          {entry.favorite ? '★' : '☆'}
                        </button>
                        <span className="pill">{entry.wordType}</span>
                        <div className="entry-menu">
                          <button
                            type="button"
                            className="entry-menu-button"
                            aria-label={`Open options for ${entry.word}`}
                            aria-expanded={openEntryMenuId === entry.id}
                            onClick={(event) => {
                              event.stopPropagation()
                              setOpenEntryMenuId((current) => current === entry.id ? null : entry.id)
                            }}
                          >
                            &#8942;
                          </button>
                          {openEntryMenuId === entry.id && (
                            <div className="entry-menu-list">
                              <button type="button" onClick={() => { handleEdit(entry); setOpenEntryMenuId(null) }}>Edit</button>
                              <button type="button" onClick={() => handleDelete(entry.id)}>Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="translation">{entry.translation || 'No translation yet'}</p>

                    {isExpanded && (
                      <dl>
                        {entry.definition && (
                          <div>
                            <dt>Definition</dt>
                            <dd>{entry.definition}</dd>
                          </div>
                        )}
                        {(entry.pronunciation || entry.automaticPronunciation || entry.voiceRecording) && (
                          <div>
                            <dt>Pronunciation</dt>
                            <dd>
                              {entry.automaticPronunciation && <span>{entry.automaticPronunciation} </span>}
                              {entry.pronunciation && <span>({entry.pronunciation})</span>}
                              {(entry.voiceRecording || recordingUrls[entry.voiceRecordingId]) && (
                                <audio controls src={entry.voiceRecording || recordingUrls[entry.voiceRecordingId]} aria-label={`Your recorded pronunciation for ${entry.word}`} />
                              )}
                            </dd>
                          </div>
                        )}
                        {entry.romanization && (
                          <div>
                            <dt>Romanization</dt>
                            <dd>{entry.romanization}</dd>
                          </div>
                        )}
                        {entry.wordType && (
                          <div>
                            <dt>Word type</dt>
                            <dd>{entry.wordType}</dd>
                          </div>
                        )}
                        {entry.example && (
                          <div>
                            <dt>Example</dt>
                            <dd>{entry.example}</dd>
                          </div>
                        )}
                        {entry.tags?.length > 0 && (
                          <div><dt>Tags</dt><dd>{entry.tags.join(', ')}</dd></div>
                        )}
                        {entry.linkedEntries?.length > 0 && (
                          <div><dt>Linked entries</dt><dd>{entry.linkedEntries.map((link) => `${link.language}: ${(languages[link.language] || []).find((linkedEntry) => linkedEntry.id === link.entryId)?.word || 'Missing entry'}`).join(', ')}</dd></div>
                        )}
                      </dl>
                    )}

                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>

      <div className="bottom-nav">
        <button type="button" className={activeTab === 'browse' ? 'is-active' : ''} onClick={() => setActiveTab('browse')}>
          Browse
        </button>
        <button type="button" className={activeTab === 'favorites' ? 'is-active' : ''} onClick={() => setActiveTab('favorites')}>
          Favorites
        </button>
        <button type="button" className={activeTab === 'study' ? 'is-active' : ''} onClick={() => { setActiveTab('study'); setStudyMode(true) }}>
          Flashcards
        </button>
      </div>

      <button type="button" className="floating-add-button" onClick={() => { setQuickAddOpen(true); document.getElementById('entry-word-input')?.focus() }}>
        +
      </button>

      {studyMode && currentStudyCard && (
        <div className="flashcard-overlay" role="dialog" aria-modal="true" aria-label="Flashcards">
          <div className="study-card">
            <div className="study-header">
              <button type="button" className="close-button" onClick={() => setStudyMode(false)} aria-label="Close flashcards">&times;</button>
            </div>

            <div className="flashcard-navigation">
              <button type="button" className="flashcard-arrow" onClick={() => { setStudyIndex((current) => (current - 1 + filteredStudyEntries.length) % filteredStudyEntries.length); setIsFlashcardFlipped(false); setStudyFeedback('') }} aria-label="Previous flashcard">&#8592;</button>
              <span>{studyIndex + 1}/{filteredStudyEntries.length}</span>
              <button type="button" className="flashcard-arrow" onClick={() => { setStudyIndex((current) => (current + 1) % filteredStudyEntries.length); setIsFlashcardFlipped(false); setStudyFeedback('') }} aria-label="Next flashcard">&#8594;</button>
            </div>

            <div className="study-filters">
              <select value={studyModeType} onChange={(event) => { setStudyModeType(event.target.value); setStudyAnswer(''); setStudyFeedback('') }} aria-label="Study mode">
                <option value="flashcard">Flashcards</option>
                <option value="typing">Typing quiz</option>
                <option value="listening">Listening quiz</option>
              </select>
              <select value={studyTag} onChange={(event) => { setStudyTag(event.target.value); setStudyIndex(0) }} aria-label="Study tag filter">
                <option value="">All tags</option>
                {allTags.map((tag) => <option key={tag}>{tag}</option>)}
              </select>
            </div>

            <h3>{currentStudyCard.word}</h3>
            <p className="study-type">{currentStudyCard.wordType}</p>

            {studyModeType === 'listening' && (
              <button type="button" className="secondary-button" onClick={() => speakWord(currentStudyCard.word, selectedLanguage)}>Play word</button>
            )}

            {studyModeType === 'typing' && (
              <div className="typing-quiz">
                <p className="study-hint">Type the translation: {currentStudyCard.word}</p>
                <input value={studyAnswer} onChange={(event) => { setStudyAnswer(event.target.value); setStudyFeedback('') }} aria-label="Quiz answer" />
                <button type="button" className="secondary-button" onClick={() => setStudyFeedback(studyAnswer.trim().toLowerCase() === currentStudyCard.translation.trim().toLowerCase() ? 'Correct' : `Answer: ${currentStudyCard.translation || 'Not provided'}`)}>Check answer</button>
                {studyFeedback && <p className="study-feedback">{studyFeedback}</p>}
              </div>
            )}

            {(isFlashcardFlipped || studyModeType === 'listening') && (
              <div className="flashcard-answer">
                <p className="translation">{currentStudyCard.translation || 'Not provided'}</p>
                <dl>
                  <div><dt>Definition</dt><dd>{currentStudyCard.definition || 'Not provided'}</dd></div>
                  <div><dt>Pronunciation</dt><dd>{currentStudyCard.automaticPronunciation || currentStudyCard.pronunciation || 'Not provided'}</dd></div>
                  <div><dt>Example</dt><dd>{currentStudyCard.example || 'Not provided'}</dd></div>
                </dl>
              </div>
            )}

            <div className="study-actions">
              <button type="button" onClick={() => setIsFlashcardFlipped((current) => !current)}>
                {isFlashcardFlipped ? 'Flip back' : 'Flip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
