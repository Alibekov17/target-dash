import React, { useRef, useEffect, useState } from 'react';
import './App.css';

const MAP_SIZE = 1800;
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;

export default function App() {
  const [gameState, setGameState] = useState('LOBBY'); // 'LOBBY' | 'PARACHUTING' | 'COMBAT' | 'GAMEOVER'
  const [isVictory, setIsVictory] = useState(false);

  const [hud, setHud] = useState({
    hp: 100,
    vest: 0,
    helmet: 0,
    ammo: 30,
    kills: 0,
    zoneTimer: 15,
    inZone: true,
    aliveEnemies: 0
  });

  const canvasRef = useRef(null);

  const gameStateRef = useRef({
    player: {
      x: MAP_SIZE / 2,
      y: MAP_SIZE / 2,
      altitude: 500,
      speed: 4,
      angle: 0,
      hp: 100,
      vest: 0,
      helmet: 0,
      ammo: 30,
      kills: 0
    },
    mouse: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
    zone: {
      x: MAP_SIZE / 2,
      y: MAP_SIZE / 2,
      currentRadius: 800,
      targetRadius: 400,
      timer: 15,
      isShrinking: false
    },
    bullets: [],
    enemies: [],
    items: [],
    keys: {}
  });

  const calculateDamage = (baseDamage, vestLevel) => {
    const reduction = vestLevel * 0.25;
    return Math.max(1, baseDamage * (1 - reduction));
  };

  // Возврат в главное меню (Лобби)
  const goToLobby = () => {
    setIsVictory(false);
    setGameState('LOBBY');
  };

  // Старт / Перезапуск матча
  const startGame = () => {
    setIsVictory(false);
    const gs = gameStateRef.current;
    
    gs.player = {
      x: Math.random() * (MAP_SIZE - 400) + 200,
      y: Math.random() * (MAP_SIZE - 400) + 200,
      altitude: 500,
      speed: 4,
      angle: 0,
      hp: 100,
      vest: 0,
      helmet: 0,
      ammo: 30,
      kills: 0
    };

    gs.zone = {
      x: MAP_SIZE / 2,
      y: MAP_SIZE / 2,
      currentRadius: 800,
      targetRadius: 400,
      timer: 15,
      isShrinking: false
    };

    gs.bullets = [];
    
    // Спавн лута
    gs.items = [];
    const itemTypes = ['ammo', 'medkit', 'vest', 'helmet'];
    for (let i = 0; i < 40; i++) {
      gs.items.push({
        id: i,
        x: Math.random() * (MAP_SIZE - 100) + 50,
        y: Math.random() * (MAP_SIZE - 100) + 50,
        type: itemTypes[Math.floor(Math.random() * itemTypes.length)]
      });
    }

    // Спавн ботов
    gs.enemies = [];
    for (let i = 0; i < 12; i++) {
      gs.enemies.push({
        id: `bot_${i}_${Date.now()}`,
        x: Math.random() * (MAP_SIZE - 200) + 100,
        y: Math.random() * (MAP_SIZE - 200) + 100,
        hp: 100,
        vest: Math.floor(Math.random() * 2),
        helmet: Math.floor(Math.random() * 2),
        angle: 0,
        lastShoot: Date.now() + Math.random() * 1000
      });
    }

    setGameState('PARACHUTING');
  };

  useEffect(() => {
    if (gameState === 'LOBBY' || gameState === 'GAMEOVER') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const gs = gameStateRef.current;

    const handleKeyDown = (e) => (gs.keys[e.code] = true);
    const handleKeyUp = (e) => (gs.keys[e.code] = false);

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      gs.mouse.x = e.clientX - rect.left;
      gs.mouse.y = e.clientY - rect.top;
      
      const screenX = gs.player.x - (gs.player.x - CANVAS_WIDTH / 2);
      const screenY = gs.player.y - (gs.player.y - CANVAS_HEIGHT / 2);
      gs.player.angle = Math.atan2(gs.mouse.y - screenY, gs.mouse.x - screenX);
    };

    const handleMouseClick = () => {
      if (gameState !== 'COMBAT' || gs.player.ammo <= 0 || isVictory) return;
      
      gs.player.ammo--;
      gs.bullets.push({
        x: gs.player.x,
        y: gs.player.y,
        vx: Math.cos(gs.player.angle) * 12,
        vy: Math.sin(gs.player.angle) * 12,
        ownerId: 'player'
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleMouseClick);

    const zoneInterval = setInterval(() => {
      if (gs.zone.timer > 0) {
        gs.zone.timer--;
      } else {
        gs.zone.isShrinking = true;
      }
    }, 1000);

    let animId;

    const loop = () => {
      // 1. ЛОГИКА ИГРЫ
      if (gameState === 'PARACHUTING') {
        gs.player.altitude -= 4;
        if (gs.player.altitude <= 0) {
          gs.player.altitude = 0;
          setGameState('COMBAT');
        }
      }

      if (gameState === 'COMBAT' && !isVictory) {
        // Управление игроком
        if (gs.keys['KeyW']) gs.player.y -= gs.player.speed;
        if (gs.keys['KeyS']) gs.player.y += gs.player.speed;
        if (gs.keys['KeyA']) gs.player.x -= gs.player.speed;
        if (gs.keys['KeyD']) gs.player.x += gs.player.speed;

        gs.player.x = Math.max(20, Math.min(MAP_SIZE - 20, gs.player.x));
        gs.player.y = Math.max(20, Math.min(MAP_SIZE - 20, gs.player.y));

        // Лут
        gs.items.forEach((item, index) => {
          if (Math.hypot(gs.player.x - item.x, gs.player.y - item.y) < 25) {
            if (item.type === 'ammo') gs.player.ammo += 30;
            if (item.type === 'medkit') gs.player.hp = Math.min(100, gs.player.hp + 40);
            if (item.type === 'vest') gs.player.vest = 1;
            if (item.type === 'helmet') gs.player.helmet = 1;
            gs.items.splice(index, 1);
          }
        });

        // Сужение зоны
        if (gs.zone.isShrinking) {
          if (gs.zone.currentRadius > gs.zone.targetRadius) {
            gs.zone.currentRadius -= 0.3;
          } else {
            gs.zone.isShrinking = false;
            gs.zone.timer = 15;
            gs.zone.targetRadius = Math.max(100, gs.zone.targetRadius - 200);
          }
        }

        // Урон игроку вне зоны
        const distPlayerToZone = Math.hypot(gs.player.x - gs.zone.x, gs.player.y - gs.zone.y);
        if (distPlayerToZone > gs.zone.currentRadius) {
          gs.player.hp -= 0.2;
        }

        // Логика Ботов
        gs.enemies.forEach((enemy, ei) => {
          const distEnemyToZoneCenter = Math.hypot(enemy.x - gs.zone.x, enemy.y - gs.zone.y);

          // Урон ботам вне зоны
          if (distEnemyToZoneCenter > gs.zone.currentRadius) {
            enemy.hp -= 0.2;
            if (enemy.hp <= 0) {
              gs.enemies.splice(ei, 1);
              return;
            }
          }

          // 🏃 ПРИОРИТЕТ 1: Если бот снаружи зоны или на её краю — он БЕЖИТ К ЦЕНТРУ ЗОНЫ!
          if (distEnemyToZoneCenter > gs.zone.currentRadius - 50) {
            const angleToZone = Math.atan2(gs.zone.y - enemy.y, gs.zone.x - enemy.x);
            enemy.angle = angleToZone;
            enemy.x += Math.cos(angleToZone) * 2.2; // Боты бегут быстрее, чтобы успеть в зону
            enemy.y += Math.sin(angleToZone) * 2.2;
          } 
          // ⚔️ ПРИОРИТЕТ 2: Если бот в зоне — ищет врагов и сражается
          else {
            let nearestTarget = null;
            let minDist = 450;

            const distToPlayer = Math.hypot(gs.player.x - enemy.x, gs.player.y - enemy.y);
            if (distToPlayer < minDist) {
              minDist = distToPlayer;
              nearestTarget = { x: gs.player.x, y: gs.player.y };
            }

            gs.enemies.forEach((otherEnemy) => {
              if (otherEnemy.id !== enemy.id) {
                const distToOther = Math.hypot(otherEnemy.x - enemy.x, otherEnemy.y - enemy.y);
                if (distToOther < minDist) {
                  minDist = distToOther;
                  nearestTarget = { x: otherEnemy.x, y: otherEnemy.y };
                }
              }
            });

            if (nearestTarget) {
              enemy.angle = Math.atan2(nearestTarget.y - enemy.y, nearestTarget.x - enemy.x);
              enemy.x += Math.cos(enemy.angle) * 1.5;
              enemy.y += Math.sin(enemy.angle) * 1.5;

              if (Date.now() - enemy.lastShoot > 1800) {
                gs.bullets.push({
                  x: enemy.x,
                  y: enemy.y,
                  vx: Math.cos(enemy.angle) * 8,
                  vy: Math.sin(enemy.angle) * 8,
                  ownerId: enemy.id
                });
                enemy.lastShoot = Date.now();
              }
            }
          }
        });

        // Пули
        for (let bi = gs.bullets.length - 1; bi >= 0; bi--) {
          const b = gs.bullets[bi];
          b.x += b.vx;
          b.y += b.vy;

          let bulletRemoved = false;

          if (b.ownerId !== 'player') {
            if (Math.hypot(b.x - gs.player.x, b.y - gs.player.y) < 18) {
              const dmg = calculateDamage(15, gs.player.vest);
              gs.player.hp -= dmg;
              gs.bullets.splice(bi, 1);
              bulletRemoved = true;
            }
          }

          if (bulletRemoved) continue;

          for (let ei = gs.enemies.length - 1; ei >= 0; ei--) {
            const enemy = gs.enemies[ei];
            if (b.ownerId !== enemy.id) {
              if (Math.hypot(b.x - enemy.x, b.y - enemy.y) < 20) {
                const dmg = calculateDamage(35, enemy.vest);
                enemy.hp -= dmg;
                gs.bullets.splice(bi, 1);

                if (enemy.hp <= 0) {
                  if (b.ownerId === 'player') {
                    gs.player.kills++;
                  }
                  gs.enemies.splice(ei, 1);
                }
                break;
              }
            }
          }
        }

        if (gs.player.hp <= 0) {
          setGameState('GAMEOVER');
        } else if (gs.enemies.length === 0) {
          setIsVictory(true);
        }
      }

      setHud({
        hp: Math.max(0, Math.round(gs.player.hp)),
        vest: gs.player.vest,
        helmet: gs.player.helmet,
        ammo: gs.player.ammo,
        kills: gs.player.kills,
        zoneTimer: gs.zone.timer,
        inZone: Math.hypot(gs.player.x - gs.zone.x, gs.player.y - gs.zone.y) <= gs.zone.currentRadius,
        aliveEnemies: gs.enemies.length
      });

      // 2. РЕНДЕРИНГ НА ХОЛСТЕ
      const cameraX = gs.player.x - CANVAS_WIDTH / 2;
      const cameraY = gs.player.y - CANVAS_HEIGHT / 2;

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.save();
      ctx.translate(-cameraX, -cameraY);

      // Зеленая Земля
      ctx.fillStyle = '#2e7d32';
      ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

      ctx.strokeStyle = '#256528';
      ctx.lineWidth = 2;
      for (let x = 0; x < MAP_SIZE; x += 100) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_SIZE); ctx.stroke();
      }
      for (let y = 0; y < MAP_SIZE; y += 100) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_SIZE, y); ctx.stroke();
      }

      // Безопасная Зона
      ctx.beginPath();
      ctx.arc(gs.zone.x, gs.zone.y, gs.zone.currentRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.fillStyle = 'rgba(0, 100, 255, 0.15)';
      ctx.fill();

      // Лут
      gs.items.forEach((item) => {
        ctx.beginPath();
        ctx.arc(item.x, item.y, 8, 0, Math.PI * 2);
        if (item.type === 'ammo') ctx.fillStyle = '#fbc02d';
        if (item.type === 'medkit') ctx.fillStyle = '#e53935';
        if (item.type === 'vest') ctx.fillStyle = '#1e88e5';
        if (item.type === 'helmet') ctx.fillStyle = '#8e24aa';
        ctx.fill();
      });

      // Враги
      gs.enemies.forEach((enemy) => {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(enemy.angle);
        ctx.fillStyle = '#d32f2f';
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Пули
      gs.bullets.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = b.ownerId === 'player' ? '#ffea00' : '#ff1744';
        ctx.fill();
      });

      // Игрок
      ctx.save();
      ctx.translate(gs.player.x, gs.player.y);

      if (gameState === 'PARACHUTING') {
        const scale = 1 + gs.player.altitude / 200;
        ctx.scale(scale, scale);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, -10, 30, Math.PI, Math.PI * 2);
        ctx.stroke();
      }

      ctx.rotate(gs.player.angle);

      ctx.fillStyle = '#111';
      ctx.fillRect(5, 5, 15, 4);

      ctx.fillStyle = '#ff9f43';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();

      if (gs.player.helmet > 0) {
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      ctx.restore();

      // Прицел
      if (gameState === 'COMBAT') {
        const mx = gs.mouse.x;
        const my = gs.mouse.y;

        ctx.strokeStyle = '#00fff5';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mx, my, 12, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ff2e63';
        ctx.beginPath();
        ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#00fff5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mx - 18, my); ctx.lineTo(mx - 14, my);
        ctx.moveTo(mx + 14, my); ctx.lineTo(mx + 18, my);
        ctx.moveTo(mx, my - 18); ctx.lineTo(mx, my - 14);
        ctx.moveTo(mx, my + 14); ctx.lineTo(mx, my + 18);
        ctx.stroke();
      }

      animId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleMouseClick);
      clearInterval(zoneInterval);
      cancelAnimationFrame(animId);
    };
  }, [gameState, isVictory]);

  return (
    <div className="br-app">
      {/* 1. ЛОББИ */}
      {gameState === 'LOBBY' && (
        <div className="lobby-screen">
          <h1 className="title"> Target Dash 2D</h1>
          <p>Выживайте в зоне и победите всех врагов!</p>
          <button className="btn-primary" onClick={startGame}>
            НАЧАТЬ МАТЧ
          </button>
        </div>
      )}

      {/* 2. ЭКРАН ПОБЕДЫ */}
      {isVictory && (
        <div className="victory-overlay">
          <h1 className="victory-title">VICTORY</h1>
          <p className="victory-subtitle">🏆 Вы остались последним выжившим!</p>
          <div style={{ display: 'flex', gap: '15px' }}>
            <button className="restart-btn" onClick={startGame}>
              ИГРАТЬ СНОВА
            </button>
            <button className="btn-primary" style={{ marginTop: 0 }} onClick={goToLobby}>
              В ЛОББИ
            </button>
          </div>
        </div>
      )}

      {/* 3. ЭКРАН ПОРАЖЕНИЯ */}
      {gameState === 'GAMEOVER' && (
        <div className="overlay-screen">
          <h1 className="title" style={{ color: '#f44336' }}>
            ВЫ ПОГИБЛИ 💀
          </h1>
          <p style={{ marginBottom: '20px' }}>Вас устранили. Ликвидаций: {hud.kills}</p>
          <div style={{ display: 'flex', gap: '15px' }}>
            <button className="btn-primary" style={{ marginTop: 0 }} onClick={startGame}>
              ИГРАТЬ СНОВА
            </button>
            <button 
              className="btn-primary" 
              style={{ marginTop: 0, background: '#555', color: '#fff' }} 
              onClick={goToLobby}
            >
              В ЛОББИ
            </button>
          </div>
        </div>
      )}

      {/* 4. HUD */}
      {(gameState === 'COMBAT' || gameState === 'PARACHUTING') && (
        <div className="hud-container">
          <div className="hud-card">❤️ Здоровье: {hud.hp}</div>
          <div className="hud-card">🛡️ Броня: Lvl {hud.vest} | 🪖 Шлем: Lvl {hud.helmet}</div>
          <div className="hud-card">📦 Патроны: {hud.ammo}</div>
          <div className="hud-card">🎯 Убийств: {hud.kills}</div>
          <div className="hud-card">👥 Врагов: {hud.aliveEnemies}</div>
          <div className={`hud-card ${!hud.inZone ? 'zone-warning' : ''}`}>
            ⏱️ Зона: {hud.zoneTimer}s {!hud.inZone && '(ВНЕ ЗОНЫ! -HP)'}
          </div>
        </div>
      )}

      {/* ХОЛСТ */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="game-canvas"
      />
    </div>
  );
}

  