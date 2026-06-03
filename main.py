from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
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
    balance = Column(Integer, default=1000)

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
    
    new_player = User(first_name=data.first_name, last_name=data.last_name, email=data.email, password=data.password)
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
        return {"msg": "Logged in!", "email": player.email, "first_name": player.first_name, "balance": player.balance}
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
        "game_state": game_state
    }
    db.close()
    return response

def get_game_state(session, email):
    db = SessionLocal()
    player = db.query(User).filter(User.email == email).first()
    balance = player.balance if player else 0
    db.close()
    
    return {
        "finished": False,
        "player": session["player_hands"],
        "points": [calculate_points(r) for r in session["player_hands"]],
        "active_hand": session["active_hand"],
        "status": session["hand_status"],
        "dealer": session["dealer_hand"][0],
        "balance": balance,
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
        
        is_blackjack = (player_points == 21 and len(hand) == 2)
        dealer_blackjack = (dealer_points == 21 and len(session["dealer_hand"]) == 2)
        
        if status == "lost":
            results.append("YOU LOST!")
        elif is_blackjack and not dealer_blackjack:
            results.append("BLACKJACK! YOU WON 3:2!")
            if player_db: player_db.balance += int(bet + bet * 1.5)
        elif dealer_blackjack and not is_blackjack:
            results.append("Dealer has Blackjack! YOU LOST!")
        elif dealer_points > 21:
            results.append("Dealer busted! YOU WON!")
            if player_db: player_db.balance += bet * 2
        elif player_points > dealer_points:
            results.append("YOU WON!")
            if player_db: player_db.balance += bet * 2
        elif player_points < dealer_points:
            results.append("YOU LOST!")
        else:
            results.append("PUSH!")
            if player_db: player_db.balance += bet
            
    if player_db:
        balance = player_db.balance
        db.commit()
    else:
        balance = 0
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
        "bets": bets
    }

@app.post("/start/{email}")
def start_game(email: str, data: BetRequest):
    bet = data.bet
    if bet <= 0:
        raise HTTPException(status_code=400, detail="Bet must be greater than 0")
        
    db = SessionLocal()
    player = db.query(User).filter(User.email == email).first()
    if not player:
        db.close()
        raise HTTPException(status_code=404, detail="Player does not exist")
        
    if player.balance < bet:
        db.close()
        raise HTTPException(status_code=400, detail="Insufficient funds")
        
    player.balance -= bet
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
        "bets": [bet]
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
    if player_db.balance < bet:
        db.close()
        raise HTTPException(status_code=400, detail="Not enough funds to double (need: " + str(bet) + ")")
        
    player_db.balance -= bet
    db.commit()
    db.close()
    
    session["bets"][active] += bet
        
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
    if player_db.balance < bet:
        db.close()
        raise HTTPException(status_code=400, detail="Not enough funds to split (need: " + str(bet) + ")")
        
    player_db.balance -= bet
    db.commit()
    db.close()
    
    card1 = hand[0]
    card2 = hand[1]
    
    session["player_hands"].pop(active)
    session["hand_status"].pop(active)
    session["bets"].pop(active)
    
    new_hand1 = [card1, session["deck"].pop()]
    new_hand2 = [card2, session["deck"].pop()]
    
    session["player_hands"].insert(active, new_hand2)
    session["player_hands"].insert(active, new_hand1)
    
    session["hand_status"].insert(active, "playing")
    session["hand_status"].insert(active, "playing")
    
    session["bets"].insert(active, bet)
    session["bets"].insert(active, bet)
    
    return get_game_state(session, email)
