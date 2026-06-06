# UKSW Royale Casino

UKSW Royale Casino is a dynamic web-based online casino application built in Python using the FastAPI framework. The core gameplay revolves around classic casino games like Blackjack and Roulette, seamlessly integrated with a persistent user account system. Players can manage their finances, complete progressive challenges, and utilize both real and bonus funds.

## Features

- **Classic Casino Games**: 
  - **Blackjack**: Play against the dealer with full support for hitting, standing, doubling down, and splitting.
  - **Roulette**: Bet on a dynamic horizontal roulette wheel with varied betting options and animated results.
- **Dual Balance System**: Manage your finances using two distinct wallets: Real Money (depositable/withdrawable) and Bonus Funds (earned through gameplay and promos).
- **Progressive Challenges System**: Complete dynamic tiers of tasks (e.g., wagering amounts, playing hands, making deposits) to earn exclusive bonus rewards that scale as you progress.
- **Game State Management**: Fully realized persistent user sessions featuring secure registration, login, and an interactive account dashboard detailing transaction history.

## Technologies and Tools

- **Language**: Python 3.10+
- **Backend Framework**: FastAPI, Uvicorn
- **Database**: SQLite (via SQLAlchemy ORM)
- **Frontend**: HTML5, Vanilla CSS3, Vanilla JavaScript
- **IDE**: Visual Studio Code

## How to Run the Application

If you want to view the code, test the game, or modify the project:

1. Ensure you have Python 3.10 or newer installed.
2. Clone or download this repository to your local machine.
3. Open a terminal in the main project directory.
4. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Run the application server:
   ```bash
   uvicorn main:app --reload
   ```
6. Open your preferred web browser and go to: `http://127.0.0.1:8000`

## Use Case Examples

**Example 1: The New Player Journey**

1. A new user clicks "JOIN NOW" on the landing page and fills out their registration details.
2. Upon successful registration, the user logs in and is instantly credited with $200 in Bonus Funds for testing purposes.
3. The user opens the Blackjack game, selects the "BONUS MONEY" option, places a $25 bet, and clicks "DEAL".
4. After winning a hand with Blackjack, the winnings are appropriately added to the bonus balance.

**Example 2: Completing Challenges for Rewards**

1. A player navigates to the "Challenges" tab in their "My Account" dashboard.
2. They see the "High Roller" challenge requiring them to wager $100.
3. The player switches to Roulette, wagers a total of $100 across multiple spins using Real Money.
4. Returning to the dashboard, the "High Roller" progress bar is full, and the user clicks "CLAIM".
5. The specified bonus reward is instantly added to their Bonus Balance, and the challenge automatically levels up to a higher tier with a bigger reward.

## Annotation

**Files:**
   1. index.html
   2. style.css
   3. script.js

Were created by Google Gemini AI.
