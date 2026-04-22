const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  workHours: {
    start: { type: Number, default: 9 }, // 기본 9시
    end: { type: Number, default: 18 },  // 기본 18시
    isSet: { type: Boolean, default: false } // 최초 설정 여부
  },
  gameState: {
    level: { type: Number, default: 1 },
    exp: { type: Number, default: 0 },
    money: { type: Number, default: 0 },
    stamina: { type: Number, default: 10 },
    stress: { type: Number, default: 0 },
    lastActionTime: { type: Date, default: Date.now }, // 마지막 행동/저장 시간
    inventory: {
      monamiPen: { type: Number, default: 0 }
    },
    buffs: {
      salaryLupinUntil: { type: Date, default: null } // 월급루팡 버프 종료 시간
    }
  }
});

module.exports = mongoose.model('User', UserSchema);