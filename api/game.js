// تخزين مؤقت للغرف
const rooms = new Map();

// قاموس ضخم من الكلمات (فقط الكلمة العادية للمواطنين)
const civilianWords = [
    "تفاح", "برتقال", "مطار", "محطة قطار", "طبيب", "ممرض", "مدرسة", "جامعة",
    "سيارة", "دراجة", "قهوة", "شاي", "قطة", "كلب", "بحر", "محيط", "جبل", "تلة",
    "كتاب", "مجلة", "مطعم", "كافيتيريا", "حديقة", "غابة", "هاتف", "حاسوب",
    "نظارات", "عدسات لاصقة", "كرة قدم", "كرة سلة", "سمك", "روبيان", "دجاج", "لحم",
    "خبز", "كعكة", "لبن", "زبادي", "فندق", "نزل", "شاطئ", "نهر", "نجم", "قمر",
    "زهرة", "شجرة", "فراشة", "نحلة", "ذهب", "فضة", "فضاء", "سماء", "طائرة", "هليكوبتر",
    "قطار", "باص", "سفينة", "قارب", "جيش", "شرطة", "مستشفى", "عيادة", "صيدلية", "متجر",
    "مسجد", "كنيسة", "زفاف", "عقيقة", "عيد", "مناسبة", "صيف", "شتاء", "ربيع", "خريف",
    "ثلج", "مطر", "ريح", "عاصفة", "نار", "لهب", "ماء", "عصير", "عسل", "سكر", "ملح", "فلفل",
    "سكين", "مقص", "ملعقة", "شوكة", "كرسي", "طاولة", "سرير", "أريكة", "مرآة", "نافذة",
    "باب", "شباك", "حذاء", "جورب", "قبعة", "طاقية", "ساعة", "منبه", "كاميرا", "فيديو",
    "راديو", "تلفاز", "إنترنت", "واي فاي", "بريد", "رسالة", "ورق", "قلم", "ممحاة", "مسطرة",
    "حقيبة", "شنطة", "محفظة", "نقود", "بطاقة", "هوية", "مفتاح", "قفل", "درج", "خزانة",
    "ثلاجة", "مجمد", "فرن", "مايكروويف", "غسالة", "نشافة", "مكنسة", "ممسحة", "صابون", "شامبو",
    "معجون أسنان", "فرشاة أسنان", "موسيقى", "غناء", "رسم", "تلوين", "رقص", "باليه", "تمثيل",
    "سينما", "مسرحية", "أوبرا", "مهرجان", "حفل", "سوق", "بازار", "بنك", "صراف", "مكتب", "شركة",
    "مصنع", "ورشة", "مزرعة", "حقل", "صحراء", "واحة", "جزيرة", "شبه جزيرة", "كهف", "نفق",
    "جسر", "سد", "برج", "ناطحة سحاب", "قصر", "فيلا", "كوخ", "خيمة", "حديقة حيوان", "أكواريوم",
    "متحف", "معرض", "مكتبة", "دار نشر", "ملعب", "صالة رياضية", "حمام سباحة", "نادي", "بار"
];

function getRandomCivilianWord() {
    const idx = Math.floor(Math.random() * civilianWords.length);
    return civilianWords[idx];
}

function newRoomState(roomCode, hostId, hostName, maxPlayers) {
    return {
        roomCode,
        host: hostId,
        players: [{ id: hostId, name: hostName, isSpy: false, word: null, votedFor: null }],
        maxPlayers: maxPlayers || 4,
        gameStarted: false,
        gameActive: false,
        roundEnded: false,
        spyWinner: false,
        civilianWord: null,
        chat: [],
        votes: {},
        votedPlayers: [],
        createdAt: Date.now()
    };
}

function assignRoles(state) {
    const word = getRandomCivilianWord();
    state.civilianWord = word;
    // اختيار جاسوس عشوائي
    const spyIndex = Math.floor(Math.random() * state.players.length);
    state.players.forEach((p, idx) => {
        if (idx === spyIndex) {
            p.isSpy = true;
            p.word = "🔍 أنت الجاسوس! حاول معرفة الكلمة من خلال النقاش";
        } else {
            p.isSpy = false;
            p.word = word;
        }
    });
}

function checkGameEnd(state) {
    if (!state.gameActive) return;
    const totalPlayers = state.players.length;
    const votesCount = state.votedPlayers.length;
    if (votesCount === totalPlayers) {
        // احتساب الأصوات
        let maxVotes = 0;
        let votedOut = null;
        for (let [pid, count] of Object.entries(state.votes)) {
            if (count > maxVotes) {
                maxVotes = count;
                votedOut = pid;
            }
        }
        const eliminated = state.players.find(p => p.id === votedOut);
        if (eliminated && eliminated.isSpy) {
            state.spyWinner = false;
            state.roundEnded = true;
            state.gameActive = false;
            state.chat.push({ sender: 'نظام', text: `🕵️ تم طرد الجاسوس (${eliminated.name})! المواطنون فازوا!`, system: true });
        } else {
            state.spyWinner = true;
            state.roundEnded = true;
            state.gameActive = false;
            state.chat.push({ sender: 'نظام', text: `💀 تم طرد مواطن! الجاسوس فاز!`, system: true });
        }
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { action, roomCode, playerName, playerId, maxPlayers, message, targetId } = req.body;

    try {
        switch (action) {
            case 'create': {
                if (rooms.has(roomCode)) return res.json({ success: false, error: 'الغرفة موجودة' });
                const newPlayerId = Math.random().toString(36).substring(2, 10);
                const state = newRoomState(roomCode, newPlayerId, playerName, maxPlayers);
                rooms.set(roomCode, state);
                return res.json({ success: true, playerId: newPlayerId });
            }
            case 'join': {
                const state = rooms.get(roomCode);
                if (!state) return res.json({ success: false, error: 'الغرفة غير موجودة' });
                if (state.gameStarted) return res.json({ success: false, error: 'بدأت اللعبة بالفعل، لا يمكن الانضمام' });
                if (state.players.length >= state.maxPlayers) return res.json({ success: false, error: 'الغرفة ممتلئة' });
                const newPlayerId = Math.random().toString(36).substring(2, 10);
                state.players.push({ id: newPlayerId, name: playerName, isSpy: false, word: null, votedFor: null });
                state.chat.push({ sender: 'نظام', text: `👋 انضم ${playerName} إلى الغرفة`, system: true });
                return res.json({ success: true, playerId: newPlayerId });
            }
            case 'start': {
                const state = rooms.get(roomCode);
                if (!state) return res.json({ success: false, error: 'الغرفة غير موجودة' });
                if (state.gameStarted) return res.json({ success: false, error: 'اللعبة بدأت بالفعل' });
                if (state.players.length < 2) return res.json({ success: false, error: 'يحتاج على الأقل 2 لاعبين' });
                state.gameStarted = true;
                state.gameActive = true;
                state.roundEnded = false;
                state.votes = {};
                state.votedPlayers = [];
                assignRoles(state);
                state.chat.push({ sender: 'نظام', text: '🎮 بدأت اللعبة! المواطنون لديهم نفس الكلمة، الجاسوس يحاول معرفتها.', system: true });
                return res.json({ success: true });
            }
            case 'getState': {
                const state = rooms.get(roomCode);
                if (!state) return res.json({ success: false, error: 'الغرفة غير موجودة' });
                const player = state.players.find(p => p.id === playerId);
                if (!player) return res.json({ success: false, error: 'لاعب غير موجود' });
                const safeState = {
                    players: state.players.map(p => ({ id: p.id, name: p.name })),
                    host: state.host,
                    gameStarted: state.gameStarted,
                    gameActive: state.gameActive,
                    roundEnded: state.roundEnded,
                    spyWinner: state.spyWinner,
                    maxPlayers: state.maxPlayers,
                    chat: state.chat,
                    votes: state.votes,
                    votedPlayers: state.votedPlayers,
                    playerWord: state.gameActive ? player.word : null
                };
                return res.json({ success: true, state: safeState });
            }
            case 'chat': {
                const state = rooms.get(roomCode);
                if (!state) return res.json({ success: false, error: 'الغرفة غير موجودة' });
                const player = state.players.find(p => p.id === playerId);
                if (!player) return res.json({ success: false, error: 'لاعب غير موجود' });
                state.chat.push({ sender: player.name, text: message, system: false });
                return res.json({ success: true });
            }
            case 'vote': {
                const state = rooms.get(roomCode);
                if (!state) return res.json({ success: false, error: 'الغرفة غير موجودة' });
                if (!state.gameActive || state.roundEnded) return res.json({ success: false, error: 'لا يمكن التصويت الآن' });
                if (state.votedPlayers.includes(playerId)) return res.json({ success: false, error: 'لقد صوت مسبقاً' });
                const target = state.players.find(p => p.id === targetId);
                if (!target) return res.json({ success: false, error: 'اللاعب المستهدف غير موجود' });
                state.votes[targetId] = (state.votes[targetId] || 0) + 1;
                state.votedPlayers.push(playerId);
                state.chat.push({ sender: 'نظام', text: `${state.players.find(p => p.id === playerId).name} صوت ضد ${target.name}`, system: true });
                checkGameEnd(state);
                return res.json({ success: true });
            }
            default:
                return res.status(400).json({ error: 'إجراء غير معروف' });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'خطأ في الخادم' });
    }
    }
