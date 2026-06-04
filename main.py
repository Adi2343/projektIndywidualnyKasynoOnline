from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, Column, Integer, String, text, ForeignKey, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from pydantic import BaseModel
import random

#######BAZA DANYCH
engine = create_engine("sqlite:///./kasyno.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String)
    last_name = Column(String)
    email = Column(String, unique=True)
    password = Column(String)
    balance = Column(Integer, default=0)
    bonus_balance = Column(Integer, default=200)
    total_wagered = Column(Integer, default=0)
    hands_played = Column(Integer, default=0)
    deposits_count = Column(Integer, default=0)
    chal_wager_claimed = Column(Integer, default=0)
    chal_hands_claimed = Column(Integer, default=0)
    chal_deposit_claimed = Column(Integer, default=0)
    transactions = relationship("Transaction", back_populates="user")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    type = Column(String)
    amount = Column(Integer)
    status = Column(String)
    date = Column(DateTime, default=datetime.utcnow)
    method = Column(String)
    
    user = relationship("User", back_populates="transactions")

Base.metadata.create_all(bind=engine)

class UserAuth(BaseModel):
    email: str
    password: str

class UserRegister(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str

class BetRequest(BaseModel):
    bet: int
    fund_source: str = "real"

class PaymentRequest(BaseModel):
    amount: int
    method: str
    promo_code: str = ""

class WithdrawRequest(BaseModel):
    amount: int
########

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="frontend"), name="static")

game_sessions = {}

def create_deck():
    ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    suits = ['♠', '♣', '♥', '♦']
    
    deck = []
    for s in suits:
        for r in ranks:
            deck.append(r + s)
    
    random.shuffle(deck)
    return deck

def calculate_points(hand):
    points = 0
    aces = 0
    
    values = {
        '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10,
        'J':10, 'Q':10, 'K':10, 'A':11
    }
    
    for card in hand:
        rank = card[:-1]
        points += values[rank]
        if rank == 'A':
            aces += 1
            
    while points > 21 and aces > 0:
        points -= 10
        aces -= 1
        
    return points

@app.get("/")
async def main_page():
    return FileResponse('frontend/index.html')

@app.post("/register")
def register(data: UserRegister):
    db = SessionLocal()
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        db.close()
        return {"error": "This email is already taken!"}
    
    new_player = User(first_name=data.first_name, last_name=data.last_name, email=data.email, password=data.password, balance=0, bonus_balance=200)
    db.add(new_player)
    db.commit()
    db.close()
    return {"msg": "Account created! You can now log in."}

@app.post("/login")
def login(data: UserAuth):
    db = SessionLocal()
    player = db.query(User).filter(User.email == data.email, User.password == data.password).first()
    db.close()
    
    if player:
        return {"msg": "Logged in!", "email": player.email, "first_name": player.first_name, "balance": player.balance, "bonus_balance": player.bonus_balance}
    return {"error": "Invalid email or password!"}

@app.get("/state/{email}")
def get_state(email: str):
    db = SessionLocal()
    player = db.query(User).filter(User.email == email).first()
    if not player:
        db.close()
        raise HTTPException(status_code=404, detail="Player not found")
        
    game_state = None
    if email in game_sessions:
        game_state = get_game_state(game_sessions[email], email)
        
    response = {
        "email": player.email,
        "first_name": player.first_name,
        "balance": player.balance,
        "bonus_balance": player.bonus_balance,
        "total_wagered": player.total_wagered,
        "hands_played": player.hands_played,
        "deposits_count": player.deposits_count,
        "chal_wager_claimed": player.chal_wager_claimed,
        "chal_hands_claimed": player.chal_hands_claimed,
        "chal_deposit_claimed": player.chal_deposit_claimed,
        "game_state": game_state
    }
    db.close()
    return response

def get_game_state(session, email):
    db = SessionLocal()
    player = db.query(User).filter(User.email == email).first()
    balance = player.balance if player else 0
    bonus_balance = player.bonus_balance if player else 0
    db.close()
    
    return {
        "finished": False,
        "player": session["player_hands"],
        "points": [calculate_points(r) for r in session["player_hands"]],
        "active_hand": session["active_hand"],
        "status": session["hand_status"],
        "dealer": session["dealer_hand"][0],
        "balance": balance,
        "bonus_balance": bonus_balance,
        "bets": session["bets"]
    }

def end_game(email):
    session = game_sessions[email]
    all_lost = all(s == "lost" for s in session["hand_status"])
    
    if not all_lost:
        while calculate_points(session["dealer_hand"]) < 17:
            session["dealer_hand"].append(session["deck"].pop())
            
    dealer_points = calculate_points(session["dealer_hand"])
    results = []
    
    db = SessionLocal()
    player_db = db.query(User).filter(User.email == email).first()
    
    for i, hand in enumerate(session["player_hands"]):
        player_points = calculate_points(hand)
        status = session["hand_status"][i]
        bet = session["bets"][i]
        real_bet = session["real_bets"][i]
        bonus_bet = session["bonus_bets"][i]
        
        is_blackjack = (player_points == 21 and len(hand) == 2)
        dealer_blackjack = (dealer_points == 21 and len(session["dealer_hand"]) == 2)
        
        if status == "lost":
            results.append("YOU LOST!")
        elif is_blackjack and not dealer_blackjack:
            results.append("BLACKJACK! YOU WON 3:2!")
            if player_db: 
                player_db.balance += real_bet + int(bet * 1.5)
                player_db.bonus_balance += bonus_bet
        elif dealer_blackjack and not is_blackjack:
            results.append("Dealer has Blackjack! YOU LOST!")
        elif dealer_points > 21:
            results.append("Dealer busted! YOU WON!")
            if player_db: 
                player_db.balance += real_bet + bet
                player_db.bonus_balance += bonus_bet
        elif player_points > dealer_points:
            results.append("YOU WON!")
            if player_db: 
                player_db.balance += real_bet + bet
                player_db.bonus_balance += bonus_bet
        elif player_points < dealer_points:
            results.append("YOU LOST!")
        else:
            results.append("PUSH!")
            if player_db: 
                player_db.balance += real_bet
                player_db.bonus_balance += bonus_bet
            
    if player_db:
        balance = player_db.balance
        bonus_balance = player_db.bonus_balance
        db.commit()
    else:
        balance = 0
        bonus_balance = 0
    db.close()
    
    player_hands = session["player_hands"]
    dealer_hand = session["dealer_hand"]
    bets = session["bets"]
    
    del game_sessions[email]
    
    return {
        "finished": True,
        "dealer_hand": dealer_hand,
        "dealer_points": dealer_points,
        "results": results,
        "player": player_hands,
        "points": [calculate_points(r) for r in player_hands],
        "balance": balance,
        "bonus_balance": bonus_balance,
        "bets": bets
    }

@app.post("/start/{email}")
def start_game(email: str, data: BetRequest):
    bet = data.bet
    fund_source = data.fund_source
    if bet <= 0:
        raise HTTPException(status_code=400, detail="Bet must be greater than 0")
    if fund_source not in ["real", "bonus"]:
        raise HTTPException(status_code=400, detail="Invalid fund source")
        
    db = SessionLocal()
    player = db.query(User).filter(User.email == email).first()
    if not player:
        db.close()
        raise HTTPException(status_code=404, detail="Player does not exist")
        
    if fund_source == "real":
        if player.balance < bet:
            db.close()
            raise HTTPException(status_code=400, detail="Insufficient real funds")
        player.balance -= bet
        player.total_wagered += bet
        real_bet = bet
        bonus_bet = 0
    else:
        if player.bonus_balance < bet:
            db.close()
            raise HTTPException(status_code=400, detail="Insufficient bonus funds")
        player.bonus_balance -= bet
        real_bet = 0
        bonus_bet = bet
        
    player.hands_played += 1
        
    db.commit()
    db.close()

    deck = create_deck()
    player_hand = [deck.pop(), deck.pop()]
    dealer_hand = [deck.pop()]
    
    game_sessions[email] = {
        "deck": deck,
        "player_hands": [player_hand],
        "active_hand": 0,
        "dealer_hand": dealer_hand,
        "hand_status": ["playing"],
        "bets": [bet],
        "real_bets": [real_bet],
        "bonus_bets": [bonus_bet]
    }
    
    return get_game_state(game_sessions[email], email)

@app.post("/hit/{email}")
def hit(email: str):
    if email not in game_sessions:
        raise HTTPException(status_code=400, detail="No active game")
    
    session = game_sessions[email]
    active = session["active_hand"]
    
    new_card = session["deck"].pop()
    session["player_hands"][active].append(new_card)
    
    points = calculate_points(session["player_hands"][active])
    
    if points > 21:
        session["hand_status"][active] = "lost"
        if active + 1 < len(session["player_hands"]):
            session["active_hand"] += 1
        else:
            return end_game(email)
            
    return get_game_state(session, email)

@app.post("/stand/{email}")
def stand(email: str):
    if email not in game_sessions:
        raise HTTPException(status_code=400, detail="No active game")
    
    session = game_sessions[email]
    session["hand_status"][session["active_hand"]] = "stand"
    
    if session["active_hand"] + 1 < len(session["player_hands"]):
        session["active_hand"] += 1
        return get_game_state(session, email)
    else:
        return end_game(email)

@app.post("/double/{email}")
def double(email: str):
    if email not in game_sessions:
        raise HTTPException(status_code=400, detail="No active game")
        
    session = game_sessions[email]
    active = session["active_hand"]
    
    if len(session["player_hands"][active]) != 2:
        raise HTTPException(status_code=400, detail="Double is only available for the first 2 cards")
        
    bet = session["bets"][active]
    db = SessionLocal()
    player_db = db.query(User).filter(User.email == email).first()
    
    is_real = session["real_bets"][active] > 0
    
    if is_real:
        if player_db.balance < bet:
            db.close()
            raise HTTPException(status_code=400, detail="Not enough real funds to double")
        player_db.balance -= bet
        real_bet = bet
        bonus_bet = 0
    else:
        if player_db.bonus_balance < bet:
            db.close()
            raise HTTPException(status_code=400, detail="Not enough bonus funds to double")
        player_db.bonus_balance -= bet
        real_bet = 0
        bonus_bet = bet
        
    db.commit()
    db.close()
    
    session["bets"][active] += bet
    session["real_bets"][active] += real_bet
    session["bonus_bets"][active] += bonus_bet
        
    new_card = session["deck"].pop()
    session["player_hands"][active].append(new_card)
    
    points = calculate_points(session["player_hands"][active])
    if points > 21:
        session["hand_status"][active] = "lost"
    else:
        session["hand_status"][active] = "stand"
        
    if session["active_hand"] + 1 < len(session["player_hands"]):
        session["active_hand"] += 1
        return get_game_state(session, email)
    else:
        return end_game(email)

@app.post("/split/{email}")
def split(email: str):
    if email not in game_sessions:
        raise HTTPException(status_code=400, detail="No active game")
        
    session = game_sessions[email]
    active = session["active_hand"]
    hand = session["player_hands"][active]
    
    if len(hand) != 2:
        raise HTTPException(status_code=400, detail="Split is only available for the first 2 cards")
        
    rank1 = hand[0][:-1]
    rank2 = hand[1][:-1]
    
    values = {
        '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10,
        'J':10, 'Q':10, 'K':10, 'A':11
    }
    
    if values[rank1] != values[rank2]:
        raise HTTPException(status_code=400, detail="Cards must have the same value to split")
            
    bet = session["bets"][active]
    db = SessionLocal()
    player_db = db.query(User).filter(User.email == email).first()
    
    is_real = session["real_bets"][active] > 0
    
    if is_real:
        if player_db.balance < bet:
            db.close()
            raise HTTPException(status_code=400, detail="Not enough real funds to split")
        player_db.balance -= bet
        real_bet = bet
        bonus_bet = 0
    else:
        if player_db.bonus_balance < bet:
            db.close()
            raise HTTPException(status_code=400, detail="Not enough bonus funds to split")
        player_db.bonus_balance -= bet
        real_bet = 0
        bonus_bet = bet
        
    db.commit()
    db.close()
    
    card1 = hand[0]
    card2 = hand[1]
    
    session["player_hands"].pop(active)
    session["hand_status"].pop(active)
    session["bets"].pop(active)
    orig_real = session["real_bets"].pop(active)
    orig_bonus = session["bonus_bets"].pop(active)
    
    new_hand1 = [card1, session["deck"].pop()]
    new_hand2 = [card2, session["deck"].pop()]
    
    session["player_hands"].insert(active, new_hand2)
    session["player_hands"].insert(active, new_hand1)
    
    session["hand_status"].insert(active, "playing")
    session["hand_status"].insert(active, "playing")
    
    session["bets"].insert(active, bet)
    session["bets"].insert(active, bet)
    
    session["real_bets"].insert(active, real_bet)
    session["real_bets"].insert(active, orig_real)
    
    session["bonus_bets"].insert(active, bonus_bet)
    session["bonus_bets"].insert(active, orig_bonus)
    
    return get_game_state(session, email)
@app.post("/deposit/{email}")
def make_deposit(email: str, data: PaymentRequest):
    db = SessionLocal()
    player = db.query(User).filter(User.email == email).first()
    if not player:
        db.close()
        raise HTTPException(status_code=404, detail="Player not found")
        
    if data.amount <= 0:
        db.close()
        raise HTTPException(status_code=400, detail="Invalid amount")
        
    player.balance += data.amount
    player.deposits_count += 1
    
    tx = Transaction(user_id=player.id, type="Deposit", amount=data.amount, status="Completed", method=data.method)
    db.add(tx)
    
    if data.promo_code.upper() == "START":
        player.bonus_balance += 50
        tx_bonus = Transaction(user_id=player.id, type="Promo Bonus", amount=50, status="Completed", method="Promo Code")
        db.add(tx_bonus)
        
    db.commit()
    db.close()
    return {"msg": "Deposit successful", "balance": player.balance, "bonus_balance": player.bonus_balance}

@app.post("/withdraw/{email}")
def make_withdraw(email: str, data: WithdrawRequest):
    db = SessionLocal()
    player = db.query(User).filter(User.email == email).first()
    if not player:
        db.close()
        raise HTTPException(status_code=404, detail="Player not found")
        
    if data.amount <= 0 or data.amount > player.balance:
        db.close()
        raise HTTPException(status_code=400, detail="Invalid amount or insufficient funds")
        
    player.balance -= data.amount
    tx = Transaction(user_id=player.id, type="Withdrawal", amount=data.amount, status="Pending", method="Bank Transfer")
    db.add(tx)
    db.commit()
    db.close()
    return {"msg": "Withdrawal requested successfully", "balance": player.balance}

@app.get("/history/{email}")
def get_history(email: str):
    db = SessionLocal()
    player = db.query(User).filter(User.email == email).first()
    if not player:
        db.close()
        raise HTTPException(status_code=404, detail="Player not found")
        
    txs = db.query(Transaction).filter(Transaction.user_id == player.id).order_by(Transaction.date.desc()).all()
    history = []
    for t in txs:
        history.append({
            "id": t.id,
            "type": t.type,
            "amount": t.amount,
            "status": t.status,
            "date": t.date.strftime("%Y-%m-%d %H:%M"),
            "method": t.method
        })
    db.close()
    return {"history": history}

@app.post("/claim_challenge/{email}/{challenge_id}")
def claim_challenge(email: str, challenge_id: str):
    db = SessionLocal()
    player = db.query(User).filter(User.email == email).first()
    if not player:
        db.close()
        raise HTTPException(status_code=404, detail="Player not found")

    if challenge_id == "wager":
        level = player.chal_wager_claimed
        targets = [100, 300, 1000]
        rewards = [25, 50, 150]
        if level < len(targets) and player.total_wagered >= targets[level]:
            reward = rewards[level]
            player.bonus_balance += reward
            player.chal_wager_claimed += 1
            tx = Transaction(user_id=player.id, type="Challenge Reward", amount=reward, status="Completed", method=f"High Roller Lvl {level+1}")
            db.add(tx)
        else:
            db.close()
            raise HTTPException(status_code=400, detail="Challenge not met or fully claimed")
            
    elif challenge_id == "hands":
        level = player.chal_hands_claimed
        targets = [10, 30, 100]
        rewards = [20, 40, 100]
        if level < len(targets) and player.hands_played >= targets[level]:
            reward = rewards[level]
            player.bonus_balance += reward
            player.chal_hands_claimed += 1
            tx = Transaction(user_id=player.id, type="Challenge Reward", amount=reward, status="Completed", method=f"BJ Veteran Lvl {level+1}")
            db.add(tx)
        else:
            db.close()
            raise HTTPException(status_code=400, detail="Challenge not met or fully claimed")
            
    elif challenge_id == "deposit":
        level = player.chal_deposit_claimed
        targets = [1, 3, 10]
        rewards = [10, 20, 50]
        if level < len(targets) and player.deposits_count >= targets[level]:
            reward = rewards[level]
            player.bonus_balance += reward
            player.chal_deposit_claimed += 1
            tx = Transaction(user_id=player.id, type="Challenge Reward", amount=reward, status="Completed", method=f"Deposit Lvl {level+1}")
            db.add(tx)
        else:
            db.close()
            raise HTTPException(status_code=400, detail="Challenge not met or fully claimed")
            
    else:
        db.close()
        raise HTTPException(status_code=400, detail="Unknown challenge")

    db.commit()
    db.close()
    return {"msg": "Challenge claimed successfully!"}
