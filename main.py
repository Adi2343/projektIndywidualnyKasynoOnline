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
import os

####### DATABASE #######
# Create the SQLite database engine.
engine = create_engine("sqlite:///./kasyno.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class User(Base):
    """
    Database model representing a user (player).
    Stores authentication data, balances (real and bonus), and challenge progression.
    """
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String)
    last_name = Column(String)
    email = Column(String, unique=True)
    password = Column(String)
    
    # Financial balances
    balance = Column(Integer, default=0)
    bonus_balance = Column(Integer, default=200) # Give 200 bonus chips initially for testing!
    
    # Challenge statistics
    total_wagered = Column(Integer, default=0)
    hands_played = Column(Integer, default=0)
    deposits_count = Column(Integer, default=0)
    
    # Tracking the claimed reward tiers
    chal_wager_claimed = Column(Integer, default=0)
    chal_hands_claimed = Column(Integer, default=0)
    chal_deposit_claimed = Column(Integer, default=0)
    
    transactions = relationship("Transaction", back_populates="user")

class Transaction(Base):
    """
    Database model representing a single financial transaction.
    Used for logging deposits, withdrawals, and challenge rewards.
    """
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    type = Column(String) # e.g. 'Deposit', 'Withdrawal', 'Challenge Reward'
    amount = Column(Integer)
    status = Column(String) # e.g. 'Completed', 'Pending'
    date = Column(DateTime, default=datetime.utcnow)
    method = Column(String)
    
    user = relationship("User", back_populates="transactions")

# Automatically create all tables defined in classes inheriting from Base,
# if they do not exist already.
Base.metadata.create_all(bind=engine)


####### DATA MODELS (PYDANTIC) #######
# Used to validate incoming data from the client (frontend) to the API.

class UserAuth(BaseModel):
    """
    Model for user login.
    
    Attributes:
        email (str): Email address.
        password (str): Password.
    """
    email: str
    password: str

class UserRegister(BaseModel):
    """
    Model for registering a new user.
    
    Attributes:
        first_name (str): First name.
        last_name (str): Last name.
        email (str): Email address.
        password (str): Password.
    """
    first_name: str
    last_name: str
    email: str
    password: str

class BetRequest(BaseModel):
    """
    Model for placing a bet (e.g., in Blackjack).
    
    Attributes:
        bet (int): Wager amount.
        fund_source (str): Source of funds ("real" or "bonus"). Defaults to "real".
    """
    bet: int
    fund_source: str = "real"

class PaymentRequest(BaseModel):
    """
    Model for deposit requests.
    
    Attributes:
        amount (int): Amount to deposit.
        method (str): Payment method (e.g., "Card", "BLIK").
        promo_code (str): Optional promo code.
    """
    amount: int
    method: str
    promo_code: str = ""

class WithdrawRequest(BaseModel):
    """
    Model for withdrawal requests.
    
    Attributes:
        amount (int): Amount to withdraw.
    """
    amount: int

class RouletteBetRequest(BaseModel):
    """
    Model for placing a bet in Roulette.
    
    Attributes:
        bet_amount (int): Wager amount.
        fund_source (str): Source of funds ("real" or "bonus").
        bet_type (str): Type of bet ("red", "black", "even", "odd", "low", "high", "number").
        bet_number (int): Chosen number (if bet_type is "number"). Defaults to -1.
    """
    bet_amount: int
    fund_source: str = "real"
    bet_type: str
    bet_number: int = -1


######## FASTAPI CONFIGURATION ########

app = FastAPI()

# Allow cross-origin requests (CORS) from any origin to ease local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the static "frontend" directory to serve CSS, JS, and images
base_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.join(base_dir, "frontend")
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

# Simple dictionary holding active game sessions in server memory.
# The key is the user's email, the value is a dictionary with the current game state.
game_sessions = {}

def create_deck():
    """
    Creates and shuffles a standard 52-card deck (e.g., for Blackjack).
    
    Returns:
        list: A shuffled list of strings representing cards (e.g., ['2♠', 'K♥', 'A♣', ...]).
    """
    ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    suits = ['♠', '♣', '♥', '♦']
    
    deck = []
    # Loop through suits and ranks to create the 52 combinations
    for s in suits:
        for r in ranks:
            deck.append(r + s)
            
    # Give the deck a good shuffle before dealing
    random.shuffle(deck)
    return deck

def calculate_points(hand):
    """
    Calculates the total points for a given Blackjack hand.
    An Ace counts as 11, unless the total exceeds 21, in which case it counts as 1.
    
    Arguments:
        hand (list): A list of card strings belonging to the player or dealer.
        
    Returns:
        int: The optimized point total for the provided hand.
    """
    points = 0
    aces = 0
    
    # Dictionary translating card ranks into point values
    values = {
        '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10,
        'J':10, 'Q':10, 'K':10, 'A':11
    }
    
    for card in hand:
        rank = card[:-1] # Strip the suit (last character), keep the rank
        points += values[rank]
        if rank == 'A':
            aces += 1
            
    # If we bust (over 21) but have an Ace, we save the situation by counting the Ace as 1
    while points > 21 and aces > 0:
        points -= 10
        aces -= 1
        
    return points

@app.get("/")
async def main_page():
    """
    Endpoint serving the main HTML page.
    
    Returns:
        FileResponse: Response containing the index.html file, bypassing browser cache.
    """
    response = FileResponse(os.path.join(base_dir, 'frontend', 'index.html'))
    # Prevent caching so the browser always loads our latest changes
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.post("/register")
def register(data: UserRegister):
    """
    Endpoint for registering a new player.
    
    Arguments:
        data (UserRegister): Form data received for registration.
        
    Returns:
        dict: A success message or an error if the email is already taken.
    """
    db = SessionLocal()
    existing_user = db.query(User).filter(User.email == data.email).first()
    
    # Validation - an email can only be used once
    if existing_user:
        db.close()
        return {"error": "This email is already taken!"}
    
    # Create the new user and grant them 200 bonus chips as a welcome gift
    new_player = User(
        first_name=data.first_name, 
        last_name=data.last_name, 
        email=data.email, 
        password=data.password, 
        balance=0, 
        bonus_balance=200
    )
    db.add(new_player)
    db.commit()
    db.close()
    
    return {"msg": "Account created! You can now log in."}

@app.post("/login")
def login(data: UserAuth):
    """
    Endpoint for user login.
    
    Arguments:
        data (UserAuth): Login credentials (email, password).
        
    Returns:
        dict: Account details upon successful login or an error message.
    """
    db = SessionLocal()
    # Find the player using the exact email and password
    player = db.query(User).filter(User.email == data.email, User.password == data.password).first()
    db.close()
    
    if player:
        return {
            "msg": "Logged in!", 
            "email": player.email, 
            "first_name": player.first_name, 
            "balance": player.balance, 
            "bonus_balance": player.bonus_balance
        }
    return {"error": "Invalid email or password!"}

@app.get("/state/{email}")
def get_state(email: str):
    """
    Retrieves the full account state of a player, including any active game session.
    
    Arguments:
        email (str): The player's email address.
        
    Raises:
        HTTPException: If the player does not exist.
        
    Returns:
        dict: A summary of balances, challenge stats, and the current active game state (if any).
    """
    db = SessionLocal()
    player = db.query(User).filter(User.email == email).first()
    if not player:
        db.close()
        raise HTTPException(status_code=404, detail="Player not found")
        
    game_state = None
    # Attach the game state so the user can resume a Blackjack hand (e.g., after refreshing the page)
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
    """
    Helper function to build an object representing the current Blackjack game state.
    
    Arguments:
        session (dict): The active game session for the user.
        email (str): The player's email address.
        
    Returns:
        dict: A parsed object detailing cards on the table, point totals, and wager amounts.
    """
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
        "dealer": session["dealer_hand"][0], # Only show the dealer's first card
        "balance": balance,
        "bonus_balance": bonus_balance,
        "bets": session["bets"]
    }

def end_game(email):
    """
    Ends the Blackjack game. 
    The dealer draws cards, results are verified for each player hand, and winnings are paid out.
    
    Arguments:
        email (str): The player's email address.
        
    Returns:
        dict: Complete game results, final dealer cards, and updated account balances.
    """
    session = game_sessions[email]
    # Check if we already busted on all our split hands
    all_lost = all(s == "lost" for s in session["hand_status"])
    
    # If we have at least one hand still standing, the dealer must draw to 17
    if not all_lost:
        while calculate_points(session["dealer_hand"]) < 17:
            session["dealer_hand"].append(session["deck"].pop())
            
    dealer_points = calculate_points(session["dealer_hand"])
    results = []
    
    db = SessionLocal()
    player_db = db.query(User).filter(User.email == email).first()
    
    # Iterate over all player hands (multiple hands if the player split)
    for i, hand in enumerate(session["player_hands"]):
        player_points = calculate_points(hand)
        status = session["hand_status"][i]
        bet = session["bets"][i]
        real_bet = session["real_bets"][i]
        bonus_bet = session["bonus_bets"][i]
        
        is_blackjack = (player_points == 21 and len(hand) == 2)
        dealer_blackjack = (dealer_points == 21 and len(session["dealer_hand"]) == 2)
        
        # Heavy-duty logic to figure out who actually won
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
            results.append("PUSH!") # A tie, return the original wager
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
    
    # Game is over, clean up the session so it doesn't leak memory on the server
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
    """
    Starts a new game of Blackjack and places the player's wager.
    
    Arguments:
        email (str): The player's email address.
        data (BetRequest): Betting data.
        
    Raises:
        HTTPException: If the wager amount is invalid or funds are insufficient.
        
    Returns:
        dict: The state of the game right after dealing the first cards.
    """
    bet = data.bet
    fund_source = data.fund_source
    
    # We can't play for free, must bet something
    if bet <= 0:
        raise HTTPException(status_code=400, detail="Bet must be greater than 0")
    if fund_source not in ["real", "bonus"]:
        raise HTTPException(status_code=400, detail="Invalid fund source")
        
    db = SessionLocal()
    player = db.query(User).filter(User.email == email).first()
    if not player:
        db.close()
        raise HTTPException(status_code=404, detail="Player does not exist")
        
    # Deduct the cash from the appropriate balance
    if fund_source == "real":
        if player.balance < bet:
            db.close()
            raise HTTPException(status_code=400, detail="Insufficient real funds")
        player.balance -= bet
        player.total_wagered += bet # Increment the wager challenge tracker!
        real_bet = bet
        bonus_bet = 0
    else:
        if player.bonus_balance < bet:
            db.close()
            raise HTTPException(status_code=400, detail="Insufficient bonus funds")
        player.bonus_balance -= bet
        real_bet = 0
        bonus_bet = bet
        
    player.hands_played += 1 # Increment hands challenge tracker
        
    db.commit()
    db.close()

    # Shuffle the deck and deal - 2 cards to the player, 1 to the dealer (visible)
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
    """
    The 'Hit' action in Blackjack - the player draws another card from the deck.
    
    Arguments:
        email (str): The player's email address.
        
    Raises:
        HTTPException: If no active game session is found.
        
    Returns:
        dict: The updated game state, or triggers end_game if the player busts on their final hand.
    """
    if email not in game_sessions:
        raise HTTPException(status_code=400, detail="No active game")
    
    session = game_sessions[email]
    active = session["active_hand"]
    
    # Pull a fresh card off the top of the deck
    new_card = session["deck"].pop()
    session["player_hands"][active].append(new_card)
    
    points = calculate_points(session["player_hands"][active])
    
    # Busted! Over 21, move on to the next hand if we split
    if points > 21:
        session["hand_status"][active] = "lost"
        if active + 1 < len(session["player_hands"]):
            session["active_hand"] += 1
        else:
            return end_game(email)
            
    return get_game_state(session, email)

@app.post("/stand/{email}")
def stand(email: str):
    """
    The 'Stand' action in Blackjack - the player decides to take no more cards for the current hand.
    
    Arguments:
        email (str): The player's email address.
        
    Raises:
        HTTPException: If no active game session is found.
        
    Returns:
        dict: Game state moving to the next hand, or triggers end_game.
    """
    if email not in game_sessions:
        raise HTTPException(status_code=400, detail="No active game")
    
    session = game_sessions[email]
    # We are happy with our points, change status to stand
    session["hand_status"][session["active_hand"]] = "stand"
    
    # If we have a split hand waiting, shift focus to it
    if session["active_hand"] + 1 < len(session["player_hands"]):
        session["active_hand"] += 1
        return get_game_state(session, email)
    else:
        return end_game(email)

@app.post("/double/{email}")
def double(email: str):
    """
    The 'Double Down' action - double the wager, draw exactly ONE card, and automatically stand.
    
    Arguments:
        email (str): The player's email address.
        
    Raises:
        HTTPException: If game not found, wrong timing (only allowed on initial 2 cards), or lacking funds.
        
    Returns:
        dict: The updated game state (or final results if this was the last hand).
    """
    if email not in game_sessions:
        raise HTTPException(status_code=400, detail="No active game")
        
    session = game_sessions[email]
    active = session["active_hand"]
    
    # Doubling is strictly a first-move action
    if len(session["player_hands"][active]) != 2:
        raise HTTPException(status_code=400, detail="Double is only available for the first 2 cards")
        
    bet = session["bets"][active]
    db = SessionLocal()
    player_db = db.query(User).filter(User.email == email).first()
    
    is_real = session["real_bets"][active] > 0
    
    # Charge an additional bet matching the original wager - high risk, high reward
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
        
    # Draw one and only one card - the golden rule of doubling down
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
    """
    The 'Split' action - divide a pair into two separate hands with identical base wagers,
    provided the first two cards share the same point value (e.g., two 8s, or a 10 and a King).
    
    Arguments:
        email (str): The player's email address.
        
    Raises:
        HTTPException: If no active game, wrong timing, mismatched card values, or insufficient funds.
        
    Returns:
        dict: The game state reflecting the newly formed split hands.
    """
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
    
    # Core casino rule: the cards must hold the exact same point value
    if values[rank1] != values[rank2]:
        raise HTTPException(status_code=400, detail="Cards must have the same value to split")
            
    bet = session["bets"][active]
    db = SessionLocal()
    player_db = db.query(User).filter(User.email == email).first()
    
    is_real = session["real_bets"][active] > 0
    
    # Splitting costs another base wager, check if they can afford it
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
    
    # Dismantle the original hand from our tracking arrays
    session["player_hands"].pop(active)
    session["hand_status"].pop(active)
    session["bets"].pop(active)
    orig_real = session["real_bets"].pop(active)
    orig_bonus = session["bonus_bets"].pop(active)
    
    # Form two distinct hands, each instantly receiving a new card to start
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
    """
    Endpoint handling a deposit of funds into the player's real money balance.
    Supports promotional codes (e.g., entering START yields a $50 bonus).
    
    Arguments:
        email (str): The player's email address.
        data (PaymentRequest): Payment details.
        
    Raises:
        HTTPException: On invalid amount or if the player isn't found.
        
    Returns:
        dict: Success message alongside updated balances.
    """
    db = SessionLocal()
    player = db.query(User).filter(User.email == email).first()
    if not player:
        db.close()
        raise HTTPException(status_code=404, detail="Player not found")
        
    if data.amount <= 0:
        db.close()
        raise HTTPException(status_code=400, detail="Invalid amount")
        
    player.balance += data.amount
    player.deposits_count += 1 # Progress towards deposit challenges
    
    # Audit trail for the financial transaction
    tx = Transaction(user_id=player.id, type="Deposit", amount=data.amount, status="Completed", method=data.method)
    db.add(tx)
    
    # Secret promo code giving out free bonus cash!
    if data.promo_code.upper() == "START":
        player.bonus_balance += 50
        tx_bonus = Transaction(user_id=player.id, type="Promo Bonus", amount=50, status="Completed", method="Promo Code")
        db.add(tx_bonus)
        
    balance = player.balance
    bonus_balance = player.bonus_balance
    db.commit()
    db.close()
    return {"msg": "Deposit successful", "balance": balance, "bonus_balance": bonus_balance}

@app.post("/withdraw/{email}")
def make_withdraw(email: str, data: WithdrawRequest):
    """
    Submits a withdrawal request to cash out the player's real funds.
    
    Arguments:
        email (str): The player's email address.
        data (WithdrawRequest): Model defining the amount to withdraw.
        
    Raises:
        HTTPException: On invalid amount or insufficient funds.
        
    Returns:
        dict: Success message and the updated real money balance.
    """
    db = SessionLocal()
    player = db.query(User).filter(User.email == email).first()
    if not player:
        db.close()
        raise HTTPException(status_code=404, detail="Player not found")
        
    if data.amount <= 0 or data.amount > player.balance:
        db.close()
        raise HTTPException(status_code=400, detail="Invalid amount or insufficient funds")
        
    player.balance -= data.amount
    # Register the withdrawal as 'Pending' (waiting on accounting department approval)
    tx = Transaction(user_id=player.id, type="Withdrawal", amount=data.amount, status="Pending", method="Bank Transfer")
    db.add(tx)
    balance = player.balance
    db.commit()
    db.close()
    return {"msg": "Withdrawal requested successfully", "balance": balance}

@app.get("/history/{email}")
def get_history(email: str):
    """
    Fetches the transaction history for a user, sorted from newest to oldest.
    
    Arguments:
        email (str): The player's email address.
        
    Returns:
        dict: A list of dictionaries detailing the transactions for the Cashier view.
    """
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
    """
    Claims a reward for completing a specific challenge tier.
    The player's challenge level increments after a successful claim, opening up the next tier.
    
    Arguments:
        email (str): The player's email address.
        challenge_id (str): The identifier for the challenge ("wager", "hands", "deposit").
        
    Raises:
        HTTPException: If conditions aren't met or the ID is unrecognized.
        
    Returns:
        dict: A confirmation message of the successful claim.
    """
    db = SessionLocal()
    player = db.query(User).filter(User.email == email).first()
    if not player:
        db.close()
        raise HTTPException(status_code=404, detail="Player not found")

    # Wager challenge handling
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
            
    # Hands played challenge handling (mostly Blackjack)
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
            
    # Deposit count challenge handling
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

@app.post("/roulette/spin/{email}")
def spin_roulette(email: str, data: RouletteBetRequest):
    """
    Spins the European roulette wheel, calculating payouts based on the bet type, 
    and modifying the player's balances accordingly.
    All results are simulated pseudo-randomly on the backend; the frontend merely visualizes it!
    
    Arguments:
        email (str): The player's email address.
        data (RouletteBetRequest): Object representing the bet type and wager amount.
        
    Raises:
        HTTPException: On insufficient funds.
        
    Returns:
        dict: The final spin result, color, payout, and updated balances.
    """
    bet = data.bet_amount
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
        
    # Withdraw cash from the source the player opted to play with
    if fund_source == "real":
        if player.balance < bet:
            db.close()
            raise HTTPException(status_code=400, detail="Insufficient real funds")
        player.balance -= bet
        player.total_wagered += bet # More fuel for the wager challenges!
    else:
        if player.bonus_balance < bet:
            db.close()
            raise HTTPException(status_code=400, detail="Insufficient bonus funds")
        player.bonus_balance -= bet
        
    # Generate a random landing slot representing a standard European wheel (one Zero)
    winning_number = random.randint(0, 36)
    
    # Hardcoded matrix of red slots (everything else is black, except for the green zero)
    red_numbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]
    
    color = "green" if winning_number == 0 else ("red" if winning_number in red_numbers else "black")
    even_odd = "even" if winning_number != 0 and winning_number % 2 == 0 else ("odd" if winning_number != 0 else "none")
    low_high = "low" if 1 <= winning_number <= 18 else ("high" if 19 <= winning_number <= 36 else "none")
    
    win = False
    payout_multiplier = 0
    
    # Complex validation path checking if the player hit their specific bet type
    if data.bet_type == "red" and color == "red":
        win = True
        payout_multiplier = 2
    elif data.bet_type == "black" and color == "black":
        win = True
        payout_multiplier = 2
    elif data.bet_type == "even" and even_odd == "even":
        win = True
        payout_multiplier = 2
    elif data.bet_type == "odd" and even_odd == "odd":
        win = True
        payout_multiplier = 2
    elif data.bet_type == "low" and low_high == "low":
        win = True
        payout_multiplier = 2
    elif data.bet_type == "high" and low_high == "high":
        win = True
        payout_multiplier = 2
    elif data.bet_type == "number" and data.bet_number == winning_number:
        # A direct hit on a specific number - massive payout (35:1 + original wager returned = 36x)
        win = True
        payout_multiplier = 36

    winnings = bet * payout_multiplier if win else 0
    if win:
        if fund_source == "real":
            player.balance += winnings
        else:
            player.bonus_balance += winnings
            
    balance = player.balance
    bonus_balance = player.bonus_balance
    db.commit()
    db.close()
    
    return {
        "winning_number": winning_number,
        "color": color,
        "win": win,
        "winnings": winnings,
        "balance": balance,
        "bonus_balance": bonus_balance
    }
