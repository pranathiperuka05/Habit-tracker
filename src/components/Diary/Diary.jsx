import styles from '../../css/Diary.module.css';

// React
import {
	useEffect,
	useRef,
	useState,
	useMemo,
	useCallback,
} from 'react';

// Router
import { useLocation } from 'react-router-dom';

// Stores
import { useColorsStore } from '../../stores/colorsStore';
import { useFirebaseHabitsStore } from '../../stores/firebaseHabitsStore';
import { useFirebaseDiaryStore } from '../../stores/firebaseDiaryStore';

// Components
import NoteList from './NoteList';
import Placeholder from '../Placeholder';
import AddNoteForm from './AddNoteForm';

// Icons
import { MdStickyNote2, MdPreview } from 'react-icons/md';
import { FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';
import { ReactComponent as InfoSvg } from '../../img/information.svg';

// Libraries
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

function Diary() {
	// -----------------------------
	// Initialization
	// -----------------------------
	const location = useLocation();

	const dbColors = useColorsStore((s) => s.colors);
	const safeColors = Array.isArray(dbColors) ? dbColors : [];

	const { habits, habitsDispatch } = useFirebaseHabitsStore();
	const { mainDiary, mainDiaryDispatch } = useFirebaseDiaryStore();

	const habitTitle = location.state?.habitTitle;
	const accentColor = safeColors[location.state?.colorIndex] || safeColors[0];
	const currentStreak = location.state?.currentStreak ?? 0;

	const diary = habitTitle
		? habits.find((h) => h.title === habitTitle)?.diary
		: mainDiary;

	const hasNotes = Array.isArray(diary) && diary.length > 0;

	// -----------------------------
	// Search & Sort
	// -----------------------------
	const [searchTerm, setSearchTerm] = useState('');
	const [sortOrder, setSortOrder] = useState('newest');

	const filteredDiary = useMemo(() => {
		if (!diary) return [];
		let filtered = diary.filter((note) =>
			note.text.toLowerCase().includes(searchTerm.toLowerCase())
		);
		const [showPinnedOnly, setShowPinnedOnly] = useState(false);

		return filtered.sort((a, b) =>{
			if(b.pinned!==a.pinned)return b.pinned - a.pinned;
		
			return sortOrder === 'newest'
				? new Date(b.date) - new Date(a.date)
				: new Date(a.date) - new Date(b.date)
	});
	}, [diary, searchTerm, sortOrder ,showPinnedOnly]);

	// -----------------------------
	// Add / Edit / Delete Notes
	// -----------------------------
	const [input, setInput] = useState(localStorage.getItem('diaryDraft') || '');
	const [isEditing, setIsEditing] = useState(null);
	const formRef = useRef(null);

	const saveNote = useCallback(
		(actionType, payload) => {
			const action = { type: actionType, habitTitle, ...payload };
			if (habitTitle) habitsDispatch(action);
			else mainDiaryDispatch(action);
		},
		[habitTitle, habitsDispatch, mainDiaryDispatch]
	);

	const handleAddNote = useCallback(() => {
		if (!input.trim())return toast.error('Note is empty!');
		const newNote = {
			text: input,
			date: new Date(),
			streak: currentStreak || undefined,
			pinned: false,
		};

		saveNote('addNote', { newNote });
		toast.success('Note added!');
		localStorage.removeItem('diaryDraft');
		setInput('');
		setIsFormActive(false);
	}, [input, currentStreak, saveNote]);

	const handleEditNote = (newText) => {
		saveNote('editNote', {
			noteCreationDate: isEditing,
			newText,
		});
		setIsEditing(null);
		toast.success('Note updated!');
		setInput('');
	};

	const handleDeleteNote = (noteCreationDate) => {
		if (window.confirm('Delete this note?')) {
			saveNote('deleteNote', { noteCreationDate });
			toast('Note deleted', { icon: '🗑️' });
		}
	};

	const handleStartEdit = (noteCreationDate, text) => {
		setIsEditing(noteCreationDate);
		setInput(text);
		formRef.current?.focus();

	};
	const handleTogglePin = (noteCreationDate) => {
		saveNote('togglePin',{noteCreationDate});
	};

	// -----------------------------
	// Form + Voice + Preview
	// -----------------------------
	const [isFormActive, setIsFormActive] = useState(false);
	const [isPreview, setIsPreview] = useState(false);
	const [isListening, setIsListening] = useState(false);
	const recognitionRef = useRef(null);

	useEffect(() => {
		const handler = setTimeout(() => {
		
		
		if (input.trim()) localStorage.setItem('diaryDraft', input);
		else localStorage.removeItem('diaryDraft');
		},500);
		return() => clearTimeout(handler);
	}, [input]);

	const handleVoiceToggle = () => {
		if (!('webkitSpeechRecognition' in window)) {
			toast.error('Speech recognition not supported.');
			return;
		}

		if (!isListening) {
			const recognition = new window.webkitSpeechRecognition();
			recognition.lang = 'en-US';
			recognition.continuous = true;
			recognition.interimResults = true;

			recognition.onresult = (event) => {
				let transcript = '';
				for (let i = event.resultIndex; i < event.results.length; ++i) {
					transcript += event.results[i][0].transcript;
				}
				setInput((prev) => prev + ' ' + transcript);
			};

			recognition.start();
			recognitionRef.current = recognition;
			setIsListening(true);
			toast('🎙️ Listening...');
		} else {
			recognitionRef.current?.stop();
			setIsListening(false);
			toast.success('Voice input stopped.');
		}
	};
	useEffect(()=> {
		const handler = (e)=>{
			if(e.ctrlKey && e.key==='Enter'){
				if(isEditing)handleEditNote(input);
				else handleAddNote();
			}
		};
		window.addEventListener('keydown',handler);
		useEffect(() => {
  const handler = (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      if (isEditing) handleEditNote(input);
      else handleAddNote();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [handleAddNote, handleEditNote, input, isEditing]);


	},[handleAddNote,handleEditNote,input,isEditing]);


	// -----------------------------
	// Render
	// -----------------------------
	return (
		<div className={styles.diary}>
			<Toaster position="top-center" />

			{/* 🔍 Search + Sort */}
			{hasNotes && (
				<div className={styles.controls}>
					<input
						type="text"
						placeholder="Search notes..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className={styles.searchBox}
					/>
					<select
						value={sortOrder}
						onChange={(e) => setSortOrder(e.target.value)}
						className={styles.sortSelect}
					>
						<option value="newest">Newest first</option>
						<option value="oldest">Oldest first</option>
					</select>
					<label className={styles.pinToggle}>
						if (showPinnedOnly) filtered = filtered.filter((note) => note.pinned);
						Show Pinned Only
					</label>
				</div>
			)}

			{/* 🗒️ Notes or Placeholder */}
			<AnimatePresence mode="wait">
				{hasNotes ? (
					<motion.div
						key="noteList"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.3 }}
					>
						<NoteList
							diary={filteredDiary}
							onStartEditNote={handleStartEdit}
							onDeleteNote={handleDeleteNote}
							onPinNote={handleTogglePin}
						/>
					</motion.div>
				) : (
					<motion.div
						key="placeholder"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					>
						<Placeholder
							image={<InfoSvg />}
							title={(habitTitle ? 'This habit’s' : 'Main') + ' diary is empty'}
							desc="Add your first note to start tracking your thoughts."
							textOnButton="Add First Note"
							buttonIcon={<MdStickyNote2 />}
							onClick={() => setIsFormActive(true)}
							accentColor={accentColor}
						/>
					</motion.div>
				)}
			</AnimatePresence>

			{/* ✏️ Add/Edit Form + Markdown Preview + Voice Input */}
			{(hasNotes || isFormActive) && (
				<div className={styles.formWrapper}>
					<div className={styles.editorBar}>
						<button
							onClick={() => setIsPreview((p) => !p)}
							className={styles.previewToggle}
							title="Toggle Markdown Preview"
						>
							<MdPreview size={20} />
							{isPreview ? 'Writing' : 'Preview'}
						</button>

						<button
							onClick={handleVoiceToggle}
							className={`${styles.micButton} ${isListening ? styles.listening : ''}`}
							title="Voice Input"
						>
							{isListening ? <FaMicrophoneSlash /> : <FaMicrophone />}
						</button>
					</div>

					{isPreview ? (
						<div className={styles.previewBox}>
							<ReactMarkdown>
								{input || '*Start typing to preview...*'}
							</ReactMarkdown>
						</div>
					) : (
						<AddNoteForm
							ref={formRef}
							input={input}
							setInput={setInput}
							onFocus={() => setIsFormActive(true)}
							onSubmit={isEditing ? handleEditNote : handleAddNote}
							isSendBtnVisible={isFormActive}
						/>
					)}

					<p className={styles.charCount}>{input.length}/500</p>
				</div>
			)}
			{/* ➕ Floating Action Button*/}
			{!isFormActive &&(
				<button
				className={styles.fab}
				style={{backgroundColor:accentColor}}
				onClick={()=>setIsFormActive(true)}
				title="Add Note"
				>
					<MdStickyNote2 size = {24}/>
				</button>
			)}

			{/* Dim overlay when active */}
			{isFormActive && (
				<div
					className={styles.overlay}
					onClick={() => setIsFormActive(false)}
				/>
			)}
		</div>
	);
}

export default Diary;
