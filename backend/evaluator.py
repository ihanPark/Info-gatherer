def safe_divide(numerator, denominator):
    if numerator is None or denominator is None:
        return None
    if denominator == 0:
        return None
    return numerator / denominator


def to_percent(value):
    if value is None:
        return None
    return value * 100


def growth_rate(current_value, previous_value):
    if current_value is None or previous_value is None:
        return None
    if previous_value == 0:
        return None
    return ((current_value - previous_value) / previous_value) * 100


MODEL_CONFIGS = {
    "optimistic": {
        "name": "Optimistic",
        "score_adjustment": 5,
        "weights": {
            "growth": 0.24,
            "profitability": 0.18,
            "stability": 0.10,
            "cashFlow": 0.15,
            "valuation": 0.23,
            "macroAdjustment": 0.10,
        },
        "dcf_adjustments": {
            "growth_rate": 2.0,
            "discount_rate": -1.0,
            "terminal_growth_rate": 0.5,
        },
        "rim_adjustments": {
            "earnings_growth_rate": 2.0,
            "cost_of_equity": -1.0,
            "terminal_growth_rate": 0.5,
        },
    },
    "balanced": {
        "name": "Balanced",
        "score_adjustment": 0,
        "weights": {
            "growth": 0.18,
            "profitability": 0.18,
            "stability": 0.17,
            "cashFlow": 0.17,
            "valuation": 0.18,  
            "macroAdjustment": 0.12,
        },
        "dcf_adjustments": {
            "growth_rate": 0.0,
            "discount_rate": 0.0,
            "terminal_growth_rate": 0.0,
        },
        "rim_adjustments": {
            "earnings_growth_rate": 0.0,
            "cost_of_equity": 0.0,
            "terminal_growth_rate": 0.0,
        },
    },
    "conservative": {
        "name": "Conservative",
        "score_adjustment": -5,
        "weights": {
            "growth": 0.12,
            "profitability": 0.16,
            "stability": 0.24,
            "cashFlow": 0.20,
            "valuation": 0.16,
            "macroAdjustment": 0.12,
        },
        "dcf_adjustments": {
            "growth_rate": -2.0,
            "discount_rate": 1.0,
            "terminal_growth_rate": -0.5,
        },
        "rim_adjustments": {
            "earnings_growth_rate": -2.0,
            "cost_of_equity": 1.0,
            "terminal_growth_rate": -0.5,
        },
    },
}

MODEL_ALIASES = {
    1: "optimistic",
    2: "balanced",
    3: "conservative",
    "1": "optimistic",
    "2": "balanced",
    "3": "conservative",
    "optimistic": "optimistic",
    "balanced": "balanced",
    "conservative": "conservative",
    "opt": "optimistic",
    "bal": "balanced",
    "con": "conservative",
}


def normalize_model(model_value):
    if model_value is None:
        return "balanced"

    if isinstance(model_value, str):
        model_value = model_value.strip().lower()

    return MODEL_ALIASES.get(model_value, "balanced")


def as_number(value):
    if value is None or value == "":
        return None

    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    if number != number:
        return None

    return number


def extract_inputs(data):
    model_key = normalize_model(data.get("model"))

    return {
        "company_name": data.get("companyName") or "Unknown Company",
        "model": model_key,

        "debt_level": data.get("debtLevel"),
        "cash_flow": data.get("cashFlow"),
        "industry_type": data.get("industryType"),
        "interest_rate": data.get("interestRate"),
        "inflation": data.get("inflation"),
        "gdp_growth": data.get("gdpGrowth"),

        "stock_price": as_number(data.get("stockPrice")),
        "revenue": as_number(data.get("revenue")),
        "pre_revenue": as_number(data.get("preRevenue")),
        "operating_inc": as_number(data.get("operatingInc")),
        "net_inc": as_number(data.get("netInc")),

        "total_debt": as_number(data.get("tDebt")),
        "total_equity": as_number(data.get("tEquity")),
        "c_assets": as_number(data.get("cAssets")),
        "c_liabilities": as_number(data.get("cLiabilities")),
        "t_assets": as_number(data.get("tAssets")),

        "int_exp": as_number(data.get("intExp")),
        "cash": as_number(data.get("cash")),

        "fcf": as_number(data.get("FCF")),
        "ocf": as_number(data.get("ocf")),
        "prev_fcf": as_number(data.get("prevFCF")),

        "eps": as_number(data.get("EPS")),
        "prev_eps": as_number(data.get("prevEPS")),
        "bvps": as_number(data.get("BVpS")),
        "so": as_number(data.get("SO")),

        "ind_pe": as_number(data.get("indPE")),
        "ind_pb": as_number(data.get("indPB")),

        "industry": data.get("industry"),
        "rev_type": data.get("revType"),
        "biz_type": data.get("bizType"),

        "exp_growth": as_number(data.get("expGrowth")),
        "disc_rate": as_number(data.get("discRate")),
        "term_growth": as_number(data.get("termGrowth")),
        "proj_years": as_number(data.get("projYears")),

        "cost_of_equity": as_number(data.get("costOfEquity")),
        "payout_ratio": as_number(data.get("payoutRatio")),
    }


def calculate_metrics(inputs):
    stock_price = inputs["stock_price"]
    revenue = inputs["revenue"]
    pre_revenue = inputs["pre_revenue"]
    operating_inc = inputs["operating_inc"]
    net_inc = inputs["net_inc"]

    total_debt = inputs["total_debt"]
    total_equity = inputs["total_equity"]
    c_assets = inputs["c_assets"]
    c_liabilities = inputs["c_liabilities"]
    t_assets = inputs["t_assets"]

    int_exp = inputs["int_exp"]
    cash = inputs["cash"]

    fcf = inputs["fcf"]
    ocf = inputs["ocf"]
    prev_fcf = inputs["prev_fcf"]

    eps = inputs["eps"]
    prev_eps = inputs["prev_eps"]
    bvps = inputs["bvps"]
    so = inputs["so"]

    ind_pe = inputs["ind_pe"]
    ind_pb = inputs["ind_pb"]

    market_cap = (
        stock_price * so
        if stock_price is not None and so is not None
        else None
    )

    net_debt = (
        total_debt - cash
        if total_debt is not None and cash is not None
        else None
    )

    enterprise_value = (
        market_cap + net_debt
        if market_cap is not None and net_debt is not None
        else None
    )

    revenue_growth = growth_rate(revenue, pre_revenue)
    eps_growth = growth_rate(eps, prev_eps)
    fcf_growth = growth_rate(fcf, prev_fcf)

    operating_margin = to_percent(safe_divide(operating_inc, revenue))
    net_margin = to_percent(safe_divide(net_inc, revenue))
    roe = to_percent(safe_divide(net_inc, total_equity))
    roa = to_percent(safe_divide(net_inc, t_assets))

    debt_to_equity = safe_divide(total_debt, total_equity)
    debt_ratio = to_percent(safe_divide(total_debt, t_assets))
    current_ratio = safe_divide(c_assets, c_liabilities)
    interest_coverage_ratio = safe_divide(operating_inc, int_exp)
    net_debt_to_fcf = safe_divide(net_debt, fcf)

    fcf_margin = to_percent(safe_divide(fcf, revenue))
    ocf_margin = to_percent(safe_divide(ocf, revenue))
    fcf_conversion = to_percent(safe_divide(fcf, net_inc))
    ocf_to_net_income = to_percent(safe_divide(ocf, net_inc))

    pe = safe_divide(stock_price, eps)
    pb = safe_divide(stock_price, bvps)
    ps = safe_divide(market_cap, revenue)
    pfcf = safe_divide(market_cap, fcf)
    fcf_yield = to_percent(safe_divide(fcf, market_cap))

    ev_sales = safe_divide(enterprise_value, revenue)
    ev_fcf = safe_divide(enterprise_value, fcf)

    pe_premium = (
        to_percent(safe_divide(pe - ind_pe, ind_pe))
        if pe is not None and ind_pe is not None
        else None
    )

    pb_premium = (
        to_percent(safe_divide(pb - ind_pb, ind_pb))
        if pb is not None and ind_pb is not None
        else None
    )

    return {
        "marketCap": market_cap,
        "netDebt": net_debt,
        "enterpriseValue": enterprise_value,

        "revenueGrowth": revenue_growth,
        "epsGrowth": eps_growth,
        "fcfGrowth": fcf_growth,

        "operatingMargin": operating_margin,
        "netMargin": net_margin,
        "roe": roe,
        "roa": roa,

        "debtToEquity": debt_to_equity,
        "debtRatio": debt_ratio,
        "currentRatio": current_ratio,
        "interestCoverageRatio": interest_coverage_ratio,
        "netDebtToFCF": net_debt_to_fcf,

        "fcfMargin": fcf_margin,
        "ocfMargin": ocf_margin,
        "fcfConversion": fcf_conversion,
        "ocfToNetIncome": ocf_to_net_income,

        "pe": pe,
        "pb": pb,
        "ps": ps,
        "pfcf": pfcf,
        "fcfYield": fcf_yield,

        "evSales": ev_sales,
        "evFCF": ev_fcf,
        "pePremium": pe_premium,
        "pbPremium": pb_premium
    }

def clamp_score(score):
    if score < 0:
        return 0
    if score > 100:
        return 100
    return round(score)

def evaluate_basic_score(inputs, metrics):
    score = 0
    reasons = []

    debt_level = inputs["debt_level"]
    cash_flow = inputs["cash_flow"]
    industry_type = inputs["industry_type"]
    interest_rate = inputs["interest_rate"]
    inflation = inputs["inflation"]
    gdp_growth = inputs["gdp_growth"]

    # Debt evaluation
    if debt_level == "low":
        score += 2
        reasons.append("Low debt improves financial stability.")
    elif debt_level == "medium":
        reasons.append("Medium debt has a neutral effect on financial risk.")
    elif debt_level == "high":
        score -= 2
        reasons.append("High debt increases financial risk.")
    else:
        reasons.append("Debt level was not provided or invalid.")

    # Cash flow evaluation
    if cash_flow == "strong":
        score += 2
        reasons.append("Strong cash flow improves resilience.")
    elif cash_flow == "average":
        reasons.append("Average cash flow is acceptable but not a strong advantage.")
    elif cash_flow == "weak":
        score -= 2
        reasons.append("Weak cash flow reduces financial flexibility.")
    else:
        reasons.append("Cash flow was not provided or invalid.")

    # Interest rate evaluation
    if interest_rate == "high":
        if debt_level == "high":
            score -= 2
            reasons.append("High interest rates make high debt more dangerous.")
        elif industry_type == "growth":
            score -= 1
            reasons.append("High interest rates can pressure growth companies.")
        else:
            score -= 1
            reasons.append("High interest rates can increase borrowing costs.")
    elif interest_rate == "normal":
        reasons.append("Normal interest rates have a neutral effect.")
    elif interest_rate == "low":
        score += 1
        reasons.append("Low interest rates reduce borrowing pressure.")
    else:
        reasons.append("Interest rate situation was not provided or invalid.")

    # Inflation evaluation
    if inflation == "high":
        score -= 1
        reasons.append("High inflation may increase costs and reduce profit margins.")
    elif inflation == "normal":
        reasons.append("Normal inflation has a neutral effect.")
    elif inflation == "low":
        score += 1
        reasons.append("Low inflation supports cost stability.")
    else:
        reasons.append("Inflation situation was not provided or invalid.")

    # GDP and industry evaluation
    if gdp_growth == "weak" and industry_type == "cyclical":
        score -= 2
        reasons.append("Weak GDP growth can hurt cyclical industries.")
    elif gdp_growth == "strong" and industry_type == "growth":
        score += 2
        reasons.append("Strong GDP growth can support growth-oriented companies.")
    elif industry_type == "defensive":
        score += 1
        reasons.append("Defensive industries are usually more stable during uncertainty.")
    elif gdp_growth == "stable":
        reasons.append("Stable GDP growth has a neutral effect.")
    else:
        reasons.append("GDP growth or industry type was not enough to create a strong signal.")

    revenue_growth = metrics.get("revenueGrowth")
    if revenue_growth is not None:
        reasons.append(f"Revenue growth is {revenue_growth:.2f}%.")

    if score >= 4:
        evaluation = "Positive"
    elif score >= 0:
        evaluation = "Neutral"
    else:
        evaluation = "Negative"

    return {
        "score": score,
        "evaluation": evaluation,
        "reasons": reasons
    }

def evaluate_growth(metrics, inputs):
    score = 50
    explanations = []

    revenue_growth = metrics.get("revenueGrowth")
    eps_growth = metrics.get("epsGrowth")
    fcf_growth = metrics.get("fcfGrowth")
    exp_growth = inputs.get("exp_growth")

    if revenue_growth is not None:
        if revenue_growth >= 15:
            score += 20
            explanations.append(f"Revenue growth is strong at {revenue_growth:.2f}%.")
        elif revenue_growth >= 5:
            score += 10
            explanations.append(f"Revenue growth is moderate at {revenue_growth:.2f}%.")
        elif revenue_growth >= 0:
            score += 3
            explanations.append(f"Revenue growth is positive but slow at {revenue_growth:.2f}%.")
        else:
            score -= 15
            explanations.append(f"Revenue declined by {abs(revenue_growth):.2f}%.")

    if eps_growth is not None:
        if eps_growth >= 15:
            score += 15
            explanations.append(f"EPS growth is strong at {eps_growth:.2f}%.")
        elif eps_growth >= 5:
            score += 8
            explanations.append(f"EPS growth is moderate at {eps_growth:.2f}%.")
        elif eps_growth < 0:
            score -= 12
            explanations.append(f"EPS declined by {abs(eps_growth):.2f}%.")

    if fcf_growth is not None:
        if fcf_growth >= 15:
            score += 15
            explanations.append(f"Free cash flow growth is strong at {fcf_growth:.2f}%.")
        elif fcf_growth >= 5:
            score += 8
            explanations.append(f"Free cash flow growth is moderate at {fcf_growth:.2f}%.")
        elif fcf_growth < 0:
            score -= 12
            explanations.append(f"Free cash flow declined by {abs(fcf_growth):.2f}%.")

    if exp_growth is not None:
        if exp_growth >= 12:
            score += 10
            explanations.append(f"Expected growth rate is high at {exp_growth:.2f}%.")
        elif exp_growth >= 5:
            score += 5
            explanations.append(f"Expected growth rate is reasonable at {exp_growth:.2f}%.")
        elif exp_growth < 0:
            score -= 10
            explanations.append(f"Expected growth rate is negative at {exp_growth:.2f}%.")

    return {
        "score": clamp_score(score),
        "explanations": explanations
    }

def evaluate_profitability(metrics):
    score = 50
    explanations = []

    operating_margin = metrics.get("operatingMargin")
    net_margin = metrics.get("netMargin")
    roe = metrics.get("roe")
    roa = metrics.get("roa")

    if operating_margin is not None:
        if operating_margin >= 25:
            score += 20
            explanations.append(f"Operating margin is very strong at {operating_margin:.2f}%.")
        elif operating_margin >= 15:
            score += 12
            explanations.append(f"Operating margin is healthy at {operating_margin:.2f}%.")
        elif operating_margin >= 5:
            score += 5
            explanations.append(f"Operating margin is acceptable at {operating_margin:.2f}%.")
        else:
            score -= 15
            explanations.append(f"Operating margin is weak at {operating_margin:.2f}%.")

    if net_margin is not None:
        if net_margin >= 20:
            score += 15
            explanations.append(f"Net margin is strong at {net_margin:.2f}%.")
        elif net_margin >= 10:
            score += 8
            explanations.append(f"Net margin is moderate at {net_margin:.2f}%.")
        elif net_margin < 3:
            score -= 12
            explanations.append(f"Net margin is low at {net_margin:.2f}%.")

    if roe is not None:
        if roe >= 20:
            score += 15
            explanations.append(f"ROE is strong at {roe:.2f}%.")
        elif roe >= 10:
            score += 8
            explanations.append(f"ROE is acceptable at {roe:.2f}%.")
        elif roe < 5:
            score -= 10
            explanations.append(f"ROE is weak at {roe:.2f}%.")

    if roa is not None:
        if roa >= 10:
            score += 10
            explanations.append(f"ROA is strong at {roa:.2f}%.")
        elif roa >= 5:
            score += 5
            explanations.append(f"ROA is acceptable at {roa:.2f}%.")
        elif roa < 2:
            score -= 8
            explanations.append(f"ROA is weak at {roa:.2f}%.")

    return {
        "score": clamp_score(score),
        "explanations": explanations
    }

def evaluate_stability(metrics):
    score = 50
    explanations = []

    debt_to_equity = metrics.get("debtToEquity")
    debt_ratio = metrics.get("debtRatio")
    current_ratio = metrics.get("currentRatio")
    interest_coverage_ratio = metrics.get("interestCoverageRatio")
    net_debt_to_fcf = metrics.get("netDebtToFCF")

    if debt_to_equity is not None:
        if debt_to_equity <= 0.5:
            score += 15
            explanations.append(f"Debt-to-equity is low at {debt_to_equity:.2f}.")
        elif debt_to_equity <= 1.5:
            score += 5
            explanations.append(f"Debt-to-equity is manageable at {debt_to_equity:.2f}.")
        else:
            score -= 15
            explanations.append(f"Debt-to-equity is high at {debt_to_equity:.2f}.")

    if debt_ratio is not None:
        if debt_ratio <= 40:
            score += 15
            explanations.append(f"Debt ratio is manageable at {debt_ratio:.2f}%.")
        elif debt_ratio <= 70:
            score += 3
            explanations.append(f"Debt ratio is moderate at {debt_ratio:.2f}%.")
        else:
            score -= 15
            explanations.append(f"Debt ratio is high at {debt_ratio:.2f}%.")

    if current_ratio is not None:
        if current_ratio >= 1.5:
            score += 10
            explanations.append(f"Current ratio is healthy at {current_ratio:.2f}.")
        elif current_ratio >= 1.0:
            score += 3
            explanations.append(f"Current ratio is acceptable at {current_ratio:.2f}.")
        else:
            score -= 12
            explanations.append(f"Current ratio is weak at {current_ratio:.2f}.")

    if interest_coverage_ratio is not None:
        if interest_coverage_ratio >= 5:
            score += 10
            explanations.append(f"Interest coverage is strong at {interest_coverage_ratio:.2f}.")
        elif interest_coverage_ratio >= 2:
            score += 3
            explanations.append(f"Interest coverage is acceptable at {interest_coverage_ratio:.2f}.")
        else:
            score -= 12
            explanations.append(f"Interest coverage is weak at {interest_coverage_ratio:.2f}.")

    if net_debt_to_fcf is not None:
        if net_debt_to_fcf <= 2:
            score += 10
            explanations.append(f"Net debt to FCF is healthy at {net_debt_to_fcf:.2f}.")
        elif net_debt_to_fcf <= 5:
            score += 3
            explanations.append(f"Net debt to FCF is moderate at {net_debt_to_fcf:.2f}.")
        else:
            score -= 10
            explanations.append(f"Net debt to FCF is high at {net_debt_to_fcf:.2f}.")

    return {
        "score": clamp_score(score),
        "explanations": explanations
    }

def evaluate_cash_flow(metrics):
    score = 50
    explanations = []

    fcf_margin = metrics.get("fcfMargin")
    ocf_margin = metrics.get("ocfMargin")
    fcf_conversion = metrics.get("fcfConversion")
    ocf_to_net_income = metrics.get("ocfToNetIncome")
    fcf_growth = metrics.get("fcfGrowth")

    if fcf_margin is not None:
        if fcf_margin >= 15:
            score += 20
            explanations.append(f"FCF margin is strong at {fcf_margin:.2f}%.")
        elif fcf_margin >= 5:
            score += 10
            explanations.append(f"FCF margin is acceptable at {fcf_margin:.2f}%.")
        elif fcf_margin < 0:
            score -= 20
            explanations.append(f"FCF margin is negative at {fcf_margin:.2f}%.")

    if ocf_margin is not None:
        if ocf_margin >= 15:
            score += 12
            explanations.append(f"Operating cash flow margin is strong at {ocf_margin:.2f}%.")
        elif ocf_margin >= 5:
            score += 6
            explanations.append(f"Operating cash flow margin is acceptable at {ocf_margin:.2f}%.")
        elif ocf_margin < 0:
            score -= 12
            explanations.append(f"Operating cash flow margin is negative at {ocf_margin:.2f}%.")

    if fcf_conversion is not None:
        if fcf_conversion >= 80:
            score += 12
            explanations.append(f"FCF conversion is strong at {fcf_conversion:.2f}%.")
        elif fcf_conversion >= 50:
            score += 5
            explanations.append(f"FCF conversion is moderate at {fcf_conversion:.2f}%.")
        else:
            score -= 8
            explanations.append(f"FCF conversion is weak at {fcf_conversion:.2f}%.")

    if ocf_to_net_income is not None:
        if ocf_to_net_income >= 100:
            score += 8
            explanations.append(f"OCF to net income is strong at {ocf_to_net_income:.2f}%.")
        elif ocf_to_net_income >= 70:
            score += 4
            explanations.append(f"OCF to net income is acceptable at {ocf_to_net_income:.2f}%.")
        else:
            score -= 6
            explanations.append(f"OCF to net income is weak at {ocf_to_net_income:.2f}%.")

    if fcf_growth is not None:
        if fcf_growth >= 10:
            score += 8
            explanations.append(f"FCF growth is positive at {fcf_growth:.2f}%.")
        elif fcf_growth < 0:
            score -= 8
            explanations.append(f"FCF declined by {abs(fcf_growth):.2f}%.")

    return {
        "score": clamp_score(score),
        "explanations": explanations
    }

def evaluate_valuation(metrics):
    score = 50
    explanations = []

    pe = metrics.get("pe")
    pb = metrics.get("pb")
    pfcf = metrics.get("pfcf")
    fcf_yield = metrics.get("fcfYield")
    ev_sales = metrics.get("evSales")
    ev_fcf = metrics.get("evFCF")
    pe_premium = metrics.get("pePremium")
    pb_premium = metrics.get("pbPremium")

    if pe is not None:
        if pe <= 15:
            score += 12
            explanations.append(f"P/E is attractive at {pe:.2f}.")
        elif pe <= 25:
            score += 5
            explanations.append(f"P/E is reasonable at {pe:.2f}.")
        elif pe <= 40:
            score -= 5
            explanations.append(f"P/E is elevated at {pe:.2f}.")
        else:
            score -= 15
            explanations.append(f"P/E is expensive at {pe:.2f}.")

    if pb is not None:
        if pb <= 2:
            score += 10
            explanations.append(f"P/B is attractive at {pb:.2f}.")
        elif pb <= 5:
            score += 3
            explanations.append(f"P/B is moderate at {pb:.2f}.")
        else:
            score -= 10
            explanations.append(f"P/B is high at {pb:.2f}.")

    if pfcf is not None:
        if pfcf <= 15:
            score += 12
            explanations.append(f"P/FCF is attractive at {pfcf:.2f}.")
        elif pfcf <= 25:
            score += 5
            explanations.append(f"P/FCF is reasonable at {pfcf:.2f}.")
        else:
            score -= 10
            explanations.append(f"P/FCF is high at {pfcf:.2f}.")

    if fcf_yield is not None:
        if fcf_yield >= 5:
            score += 12
            explanations.append(f"FCF yield is attractive at {fcf_yield:.2f}%.")
        elif fcf_yield >= 2:
            score += 4
            explanations.append(f"FCF yield is moderate at {fcf_yield:.2f}%.")
        else:
            score -= 8
            explanations.append(f"FCF yield is low at {fcf_yield:.2f}%.")

    if ev_sales is not None:
        if ev_sales <= 3:
            score += 6
            explanations.append(f"EV/Sales is reasonable at {ev_sales:.2f}.")
        elif ev_sales > 8:
            score -= 8
            explanations.append(f"EV/Sales is high at {ev_sales:.2f}.")

    if ev_fcf is not None:
        if ev_fcf <= 20:
            score += 6
            explanations.append(f"EV/FCF is reasonable at {ev_fcf:.2f}.")
        elif ev_fcf > 35:
            score -= 8
            explanations.append(f"EV/FCF is high at {ev_fcf:.2f}.")

    if pe_premium is not None:
        if pe_premium <= -15:
            score += 10
            explanations.append(f"P/E is below industry average by {abs(pe_premium):.2f}%.")
        elif pe_premium >= 25:
            score -= 10
            explanations.append(f"P/E is above industry average by {pe_premium:.2f}%.")

    if pb_premium is not None:
        if pb_premium <= -15:
            score += 8
            explanations.append(f"P/B is below industry average by {abs(pb_premium):.2f}%.")
        elif pb_premium >= 25:
            score -= 8
            explanations.append(f"P/B is above industry average by {pb_premium:.2f}%.")

    return {
        "score": clamp_score(score),
        "explanations": explanations
    }

def evaluate_macro_adjustment(inputs):
    score = 50
    explanations = []

    interest_rate = inputs["interest_rate"]
    inflation = inputs["inflation"]
    gdp_growth = inputs["gdp_growth"]
    rev_type = inputs["rev_type"]
    biz_type = inputs["biz_type"]

    if interest_rate == "low":
        score += 10
        explanations.append("Low interest rates reduce borrowing pressure.")
    elif interest_rate == "normal":
        explanations.append("Normal interest rates create a neutral macro effect.")
    elif interest_rate == "high":
        score -= 10
        explanations.append("High interest rates may increase borrowing costs and pressure valuations.")

    if inflation == "low":
        score += 8
        explanations.append("Low inflation supports cost stability.")
    elif inflation == "normal":
        explanations.append("Normal inflation has a neutral effect.")
    elif inflation == "high":
        score -= 8
        explanations.append("High inflation may pressure margins and consumer demand.")

    if gdp_growth == "strong":
        score += 10
        explanations.append("Strong GDP growth supports business expansion.")
    elif gdp_growth == "stable":
        score += 3
        explanations.append("Stable GDP growth creates a balanced macro environment.")
    elif gdp_growth == "weak":
        score -= 10
        explanations.append("Weak GDP growth may reduce demand.")

    if biz_type == "defensive" and gdp_growth == "weak":
        score += 8
        explanations.append("A defensive business type may reduce downside risk during weak GDP growth.")

    if biz_type == "cyclical" and gdp_growth == "weak":
        score -= 8
        explanations.append("A cyclical business type may suffer during weak GDP growth.")

    if biz_type == "growth" and interest_rate == "high":
        score -= 8
        explanations.append("Growth businesses can be pressured by high interest rates.")

    if rev_type == "global" and inflation == "high":
        score -= 3
        explanations.append("Global revenue exposure may increase sensitivity to inflation and currency risk.")

    if rev_type == "domestic":
        explanations.append("Domestic revenue exposure makes the company more dependent on local economic conditions.")
    elif rev_type == "international":
        explanations.append("International revenue exposure diversifies revenue but may introduce currency risk.")
    elif rev_type == "global":
        explanations.append("Global revenue exposure provides broad market access but adds macro complexity.")

    return {
        "score": clamp_score(score),
        "explanations": explanations
    }

def determine_overall_evaluation(overall_score):
    if overall_score >= 75:
        return "Positive"
    if overall_score >= 50:
        return "Neutral"
    return "Negative"


def calculate_weighted_overall_score(category_scores, model_key):
    model_config = MODEL_CONFIGS.get(model_key, MODEL_CONFIGS["balanced"])
    weights = model_config["weights"]

    weighted_sum = 0
    total_weight = 0

    for category_name, score in category_scores.items():
        weight = weights.get(category_name, 0)
        weighted_sum += score * weight
        total_weight += weight

    if total_weight == 0:
        return round(sum(category_scores.values()) / len(category_scores))

    raw_score = weighted_sum / total_weight
    adjusted_score = raw_score + model_config["score_adjustment"]

    return clamp_score(adjusted_score)


def evaluate_categories(inputs, metrics):
    model_key = inputs.get("model", "balanced")
    model_config = MODEL_CONFIGS.get(model_key, MODEL_CONFIGS["balanced"])

    growth_result = evaluate_growth(metrics, inputs)
    profitability_result = evaluate_profitability(metrics)
    stability_result = evaluate_stability(metrics)
    cash_flow_result = evaluate_cash_flow(metrics)
    valuation_result = evaluate_valuation(metrics)
    macro_adjustment_result = evaluate_macro_adjustment(inputs)

    category_scores = {
        "growth": growth_result["score"],
        "profitability": profitability_result["score"],
        "stability": stability_result["score"],
        "cashFlow": cash_flow_result["score"],
        "valuation": valuation_result["score"],
        "macroAdjustment": macro_adjustment_result["score"]
    }

    category_explanations = {
        "growth": growth_result["explanations"],
        "profitability": profitability_result["explanations"],
        "stability": stability_result["explanations"],
        "cashFlow": cash_flow_result["explanations"],
        "valuation": valuation_result["explanations"],
        "macroAdjustment": macro_adjustment_result["explanations"]
    }

    overall_score = calculate_weighted_overall_score(category_scores, model_key)
    overall_evaluation = determine_overall_evaluation(overall_score)

    return {
        "overallScore": overall_score,
        "overallEvaluation": overall_evaluation,
        "categoryScores": category_scores,
        "categoryExplanations": category_explanations,
        "modelKey": model_key,
        "modelName": model_config["name"],
        "modelWeights": model_config["weights"],
        "modelAdjustment": model_config["score_adjustment"],
    }


def evaluate_company(data):
    inputs = extract_inputs(data)
    metrics = calculate_metrics(inputs)
    category_result = evaluate_categories(inputs, metrics)

    return {
        "companyName": inputs["company_name"],
        "modelKey": category_result["modelKey"],
        "modelName": category_result["modelName"],
        "modelWeights": category_result["modelWeights"],
        "modelAdjustment": category_result["modelAdjustment"],

        "overallScore": category_result["overallScore"],
        "overallEvaluation": category_result["overallEvaluation"],

        "categoryScores": category_result["categoryScores"],
        "categoryExplanations": category_result["categoryExplanations"],

        **metrics
    }


def percent_to_decimal(percent_value):
    if percent_value is None:
        return None
    return percent_value / 100


def round_optional(value, digits=2):
    if value is None:
        return None
    return round(value, digits)


def validate_positive(value, field_name, errors):
    if value is None:
        errors.append(f"{field_name} is required.")
    elif value <= 0:
        errors.append(f"{field_name} must be greater than 0.")


def calculate_dcf(inputs):
    base_fcf = inputs["fcf"]    
    cash = inputs["cash"]
    total_debt = inputs["total_debt"]
    shares_outstanding = inputs["so"]
    stock_price = inputs["stock_price"]
    projection_years_raw = inputs["proj_years"]
    model_key = inputs["model"]
    model_config = MODEL_CONFIGS.get(model_key, MODEL_CONFIGS["balanced"])
    dcf_adjustments = model_config["dcf_adjustments"]

    errors = []
    validate_positive(base_fcf, "Free Cash Flow", errors)
    validate_positive(shares_outstanding, "Shares Outstanding", errors)
    validate_positive(inputs["disc_rate"], "Discount Rate", errors)

    if cash is None:
        errors.append("Cash and Cash Equivalents is required.")
    if total_debt is None:
        errors.append("Total Debt is required.")
    if inputs["exp_growth"] is None:
        errors.append("Expected Growth Rate is required.")
    if inputs["term_growth"] is None:
        errors.append("Terminal Growth Rate is required.")
    if projection_years_raw is None:
        errors.append("Projection Years is required.")

    projection_years = None
    if projection_years_raw is not None:    
        projection_years = int(projection_years_raw)
        if projection_years < 1 or projection_years > 10:
            errors.append("Projection Years must be between 1 and 10.")

    if stock_price is not None and stock_price <= 0:
        errors.append("Stock Price must be greater than 0 when provided.")

    if errors:
        return {
            "error": "Invalid DCF input.",
            "details": errors,
        }

    adjusted_growth_percent = inputs["exp_growth"] + dcf_adjustments["growth_rate"]
    adjusted_discount_percent = inputs["disc_rate"] + dcf_adjustments["discount_rate"]
    adjusted_terminal_percent = inputs["term_growth"] + dcf_adjustments["terminal_growth_rate"]

    growth_rate_decimal = percent_to_decimal(adjusted_growth_percent)
    discount_rate_decimal = percent_to_decimal(adjusted_discount_percent)
    terminal_growth_decimal = percent_to_decimal(adjusted_terminal_percent)

    if discount_rate_decimal <= 0:
        return {
            "error": "Invalid DCF input.",
            "details": ["Adjusted discount rate must be greater than 0."],
        }

    if discount_rate_decimal <= terminal_growth_decimal:
        return {
            "error": "Invalid DCF input.",
            "details": ["Adjusted discount rate must be greater than adjusted terminal growth rate."],
        }

    projected_cash_flows = []
    present_value_of_cash_flows = 0
    previous_fcf = base_fcf

    for year in range(1, projection_years + 1):
        projected_fcf = previous_fcf * (1 + growth_rate_decimal)
        present_value = projected_fcf / ((1 + discount_rate_decimal) ** year)
        projected_cash_flows.append({
            "year": year,
            "projectedFCF": round_optional(projected_fcf),
            "presentValue": round_optional(present_value),
        })
        present_value_of_cash_flows += present_value
        previous_fcf = projected_fcf

    final_year_fcf = previous_fcf
    terminal_value = (
        final_year_fcf * (1 + terminal_growth_decimal)
    ) / (discount_rate_decimal - terminal_growth_decimal)
    present_value_of_terminal_value = terminal_value / ((1 + discount_rate_decimal) ** projection_years)

    enterprise_value = present_value_of_cash_flows + present_value_of_terminal_value
    equity_value = enterprise_value - total_debt + cash
    intrinsic_value_per_share = safe_divide(equity_value, shares_outstanding)

    upside_downside_percent = None
    dcf_score = None
    valuation_signal = "No Market Price"

    if stock_price is not None and intrinsic_value_per_share is not None:
        upside_downside_percent = to_percent(
            safe_divide(intrinsic_value_per_share - stock_price, stock_price)
        )
        dcf_score = clamp_score(50 + upside_downside_percent)

        if upside_downside_percent >= 15:
            valuation_signal = "Positive"
        elif upside_downside_percent <= -15:
            valuation_signal = "Negative"
        else:
            valuation_signal = "Neutral"

    explanations = [
        f"{model_config['name']} model applied: growth {dcf_adjustments['growth_rate']:+.1f} pts, discount rate {dcf_adjustments['discount_rate']:+.1f} pts, terminal growth {dcf_adjustments['terminal_growth_rate']:+.1f} pts.",
        f"Projected FCF for {projection_years} years using an adjusted growth rate of {adjusted_growth_percent:.2f}%.",
        f"Terminal value calculated with adjusted discount rate {adjusted_discount_percent:.2f}% and adjusted terminal growth rate {adjusted_terminal_percent:.2f}%.",
        "Equity value is calculated as enterprise value minus total debt plus cash.",
    ]

    if upside_downside_percent is not None:
        explanations.append(f"Intrinsic value per share implies {upside_downside_percent:.2f}% upside/downside versus the current stock price.")
    else:
        explanations.append("Stock price was not provided, so upside/downside versus market price was not calculated.")

    return {
        "companyName": inputs["company_name"],
        "modelKey": model_key,
        "modelName": model_config["name"],
        "valuationSignal": valuation_signal,
        "dcfScore": dcf_score,
        "assumptions": {
            "baseFCF": round_optional(base_fcf),
            "inputGrowthRate": round_optional(inputs["exp_growth"]),
            "inputDiscountRate": round_optional(inputs["disc_rate"]),
            "inputTerminalGrowthRate": round_optional(inputs["term_growth"]),
            "adjustedGrowthRate": round_optional(adjusted_growth_percent),
            "adjustedDiscountRate": round_optional(adjusted_discount_percent),
            "adjustedTerminalGrowthRate": round_optional(adjusted_terminal_percent),
            "projectionYears": projection_years,
        },
        "projectedCashFlows": projected_cash_flows,
        "presentValueOfCashFlows": round_optional(present_value_of_cash_flows),
        "terminalValue": round_optional(terminal_value),
        "presentValueOfTerminalValue": round_optional(present_value_of_terminal_value),
        "enterpriseValue": round_optional(enterprise_value),
        "equityValue": round_optional(equity_value),
        "intrinsicValuePerShare": round_optional(intrinsic_value_per_share),
        "upsideDownsidePercent": round_optional(upside_downside_percent),
        "explanations": explanations,
    }


def evaluate_dcf(data):
    inputs = extract_inputs(data)
    return calculate_dcf(inputs)



def validate_percentage_range(value, field_name, errors, minimum=0, maximum=100):
    if value is None:
        errors.append(f"{field_name} is required.")
    elif value < minimum or value > maximum:
        errors.append(f"{field_name} must be between {minimum} and {maximum}.")


def calculate_rim(inputs):
    base_book_value = inputs["total_equity"]
    current_net_income = inputs["net_inc"]
    shares_outstanding = inputs["so"]
    stock_price = inputs["stock_price"]
    projection_years_raw = inputs["proj_years"]
    payout_ratio_percent = inputs["payout_ratio"]
    model_key = inputs["model"]
    model_config = MODEL_CONFIGS.get(model_key, MODEL_CONFIGS["balanced"])
    rim_adjustments = model_config["rim_adjustments"]

    errors = []
    validate_positive(base_book_value, "Book Value of Equity", errors)
    validate_positive(current_net_income, "Current Net Income", errors)
    validate_positive(shares_outstanding, "Shares Outstanding", errors)
    validate_positive(inputs["cost_of_equity"], "Cost of Equity", errors)

    if inputs["exp_growth"] is None:
        errors.append("Expected Net Income Growth Rate is required.")
    if inputs["term_growth"] is None:
        errors.append("Terminal Growth Rate is required.")
    validate_percentage_range(payout_ratio_percent, "Dividend Payout Ratio", errors, 0, 100)

    if projection_years_raw is None:
        errors.append("Projection Years is required.")

    projection_years = None
    if projection_years_raw is not None:
        projection_years = int(projection_years_raw)
        if projection_years < 1 or projection_years > 10:
            errors.append("Projection Years must be between 1 and 10.")

    if stock_price is not None and stock_price <= 0:
        errors.append("Stock Price must be greater than 0 when provided.")

    if errors:
        return {
            "error": "Invalid RIM input.",
            "details": errors,
        }

    adjusted_earnings_growth_percent = (
        inputs["exp_growth"] + rim_adjustments["earnings_growth_rate"]
    )
    adjusted_cost_of_equity_percent = (
        inputs["cost_of_equity"] + rim_adjustments["cost_of_equity"]
    )
    adjusted_terminal_percent = (
        inputs["term_growth"] + rim_adjustments["terminal_growth_rate"]
    )

    earnings_growth_decimal = percent_to_decimal(adjusted_earnings_growth_percent)
    cost_of_equity_decimal = percent_to_decimal(adjusted_cost_of_equity_percent)
    terminal_growth_decimal = percent_to_decimal(adjusted_terminal_percent)
    payout_ratio_decimal = percent_to_decimal(payout_ratio_percent)

    if cost_of_equity_decimal <= 0:
        return {
            "error": "Invalid RIM input.",
            "details": ["Adjusted cost of equity must be greater than 0."],
        }

    if cost_of_equity_decimal <= terminal_growth_decimal:
        return {
            "error": "Invalid RIM input.",
            "details": ["Adjusted cost of equity must be greater than adjusted terminal growth rate."],
        }

    residual_income_rows = []
    present_value_of_residual_income = 0
    beginning_book_value = base_book_value
    previous_net_income = current_net_income
    final_year_residual_income = None

    for year in range(1, projection_years + 1):
        projected_net_income = previous_net_income * (1 + earnings_growth_decimal)
        equity_charge = beginning_book_value * cost_of_equity_decimal
        residual_income = projected_net_income - equity_charge
        present_value = residual_income / ((1 + cost_of_equity_decimal) ** year)
        ending_book_value = beginning_book_value + (
            projected_net_income * (1 - payout_ratio_decimal)
        )

        residual_income_rows.append({
            "year": year,
            "beginningBookValue": round_optional(beginning_book_value),
            "projectedNetIncome": round_optional(projected_net_income),
            "equityCharge": round_optional(equity_charge),
            "residualIncome": round_optional(residual_income),
            "presentValue": round_optional(present_value),
            "endingBookValue": round_optional(ending_book_value),
        })
    
        present_value_of_residual_income += present_value
        final_year_residual_income = residual_income
        previous_net_income = projected_net_income
        beginning_book_value = ending_book_value

    terminal_residual_value = (
        final_year_residual_income * (1 + terminal_growth_decimal)
    ) / (cost_of_equity_decimal - terminal_growth_decimal)
    present_value_of_terminal_residual_value = (
        terminal_residual_value / ((1 + cost_of_equity_decimal) ** projection_years)
    )

    equity_value = (
        base_book_value
        + present_value_of_residual_income
        + present_value_of_terminal_residual_value
    )
    intrinsic_value_per_share = safe_divide(equity_value, shares_outstanding)

    upside_downside_percent = None
    rim_score = None
    valuation_signal = "No Market Price"

    if stock_price is not None and intrinsic_value_per_share is not None:
        upside_downside_percent = to_percent(
            safe_divide(intrinsic_value_per_share - stock_price, stock_price)
        )
        rim_score = clamp_score(50 + upside_downside_percent)

        if upside_downside_percent >= 15:
            valuation_signal = "Positive"
        elif upside_downside_percent <= -15:
            valuation_signal = "Negative"
        else:
            valuation_signal = "Neutral"

    explanations = [
        f"{model_config['name']} model applied: earnings growth {rim_adjustments['earnings_growth_rate']:+.1f} pts, cost of equity {rim_adjustments['cost_of_equity']:+.1f} pts, terminal growth {rim_adjustments['terminal_growth_rate']:+.1f} pts.",
        f"Residual income is calculated as projected net income minus beginning book value multiplied by adjusted cost of equity.",
        f"Book value is updated each year by adding retained earnings after the {payout_ratio_percent:.2f}% dividend payout ratio.",
        "Equity value is calculated as current book value plus the present value of projected residual income and terminal residual income.",
    ]

    if upside_downside_percent is not None:
        explanations.append(f"Intrinsic value per share implies {upside_downside_percent:.2f}% upside/downside versus the current stock price.")
    else:
        explanations.append("Stock price was not provided, so upside/downside versus market price was not calculated.")

    return {
        "companyName": inputs["company_name"],
        "modelKey": model_key,
        "modelName": model_config["name"],
        "valuationSignal": valuation_signal,
        "rimScore": rim_score,
        "assumptions": {
            "baseBookValue": round_optional(base_book_value),
            "currentNetIncome": round_optional(current_net_income),
            "inputEarningsGrowthRate": round_optional(inputs["exp_growth"]),
            "inputCostOfEquity": round_optional(inputs["cost_of_equity"]),
            "inputTerminalGrowthRate": round_optional(inputs["term_growth"]),
            "adjustedEarningsGrowthRate": round_optional(adjusted_earnings_growth_percent),
            "adjustedCostOfEquity": round_optional(adjusted_cost_of_equity_percent),
            "adjustedTerminalGrowthRate": round_optional(adjusted_terminal_percent),
            "payoutRatio": round_optional(payout_ratio_percent),
            "projectionYears": projection_years,
        },
        "residualIncomeRows": residual_income_rows,
        "presentValueOfResidualIncome": round_optional(present_value_of_residual_income),
        "terminalResidualValue": round_optional(terminal_residual_value),
        "presentValueOfTerminalResidualValue": round_optional(present_value_of_terminal_residual_value),
        "equityValue": round_optional(equity_value),
        "intrinsicValuePerShare": round_optional(intrinsic_value_per_share),
        "upsideDownsidePercent": round_optional(upside_downside_percent),
        "explanations": explanations,
    }


def evaluate_rim(data):
    inputs = extract_inputs(data)
    return calculate_rim(inputs)


SCENARIO_DEFINITIONS = {
    "bear": {
        "name": "Bear Case",
        "growth_delta": -2.0,
        "discount_delta": 1.0,
        "terminal_delta": -0.5,
    },
    "base": {
        "name": "Base Case",
        "growth_delta": 0.0,
        "discount_delta": 0.0,
        "terminal_delta": 0.0,
    },
    "bull": {
        "name": "Bull Case",
        "growth_delta": 2.0,
        "discount_delta": -1.0,
        "terminal_delta": 0.5,
    },
}


def _valuation_signal(upside_downside_percent):
    if upside_downside_percent is None:
        return "No Market Price"
    if upside_downside_percent >= 15:
        return "Positive"
    if upside_downside_percent <= -15:
        return "Negative"
    return "Neutral"


def _calculate_exact_dcf(
    base_fcf,
    cash,
    total_debt,
    shares_outstanding,
    stock_price,
    growth_percent,
    discount_percent,
    terminal_percent,
    projection_years,
):
    if discount_percent <= 0:
        raise ValueError("Discount rate must be greater than 0.")
    if discount_percent <= terminal_percent:
        raise ValueError("Discount rate must be greater than terminal growth rate.")

    growth_rate_decimal = percent_to_decimal(growth_percent)
    discount_rate_decimal = percent_to_decimal(discount_percent)
    terminal_growth_decimal = percent_to_decimal(terminal_percent)

    projected_cash_flows = []
    present_value_of_cash_flows = 0.0
    previous_fcf = base_fcf

    for year in range(1, projection_years + 1):
        projected_fcf = previous_fcf * (1 + growth_rate_decimal)
        present_value = projected_fcf / ((1 + discount_rate_decimal) ** year)
        projected_cash_flows.append({
            "year": year,
            "projectedFCF": round_optional(projected_fcf),
            "presentValue": round_optional(present_value),
        })
        present_value_of_cash_flows += present_value
        previous_fcf = projected_fcf

    terminal_value = (
        previous_fcf * (1 + terminal_growth_decimal)
    ) / (discount_rate_decimal - terminal_growth_decimal)
    present_value_of_terminal_value = (
        terminal_value / ((1 + discount_rate_decimal) ** projection_years)
    )

    enterprise_value = present_value_of_cash_flows + present_value_of_terminal_value
    equity_value = enterprise_value - total_debt + cash
    intrinsic_value_per_share = safe_divide(equity_value, shares_outstanding)

    upside_downside_percent = None
    if stock_price is not None and intrinsic_value_per_share is not None:
        upside_downside_percent = to_percent(
            safe_divide(intrinsic_value_per_share - stock_price, stock_price)
        )

    terminal_value_share_percent = to_percent(
        safe_divide(present_value_of_terminal_value, enterprise_value)
    )

    return {
        "assumptions": {
            "growthRate": round_optional(growth_percent),
            "discountRate": round_optional(discount_percent),
            "terminalGrowthRate": round_optional(terminal_percent),
            "projectionYears": projection_years,
        },
        "projectedCashFlows": projected_cash_flows,
        "presentValueOfCashFlows": round_optional(present_value_of_cash_flows),
        "terminalValue": round_optional(terminal_value),
        "presentValueOfTerminalValue": round_optional(present_value_of_terminal_value),
        "terminalValueSharePercent": round_optional(terminal_value_share_percent),
        "enterpriseValue": round_optional(enterprise_value),
        "equityValue": round_optional(equity_value),
        "intrinsicValuePerShare": round_optional(intrinsic_value_per_share),
        "upsideDownsidePercent": round_optional(upside_downside_percent),
        "valuationSignal": _valuation_signal(upside_downside_percent),
    }


def _calculate_exact_rim(
    base_book_value,
    current_net_income,
    shares_outstanding,
    stock_price,
    earnings_growth_percent,
    cost_of_equity_percent,
    terminal_percent,
    payout_ratio_percent,
    projection_years,
):
    if cost_of_equity_percent <= 0:
        raise ValueError("Cost of equity must be greater than 0.")
    if cost_of_equity_percent <= terminal_percent:
        raise ValueError("Cost of equity must be greater than terminal growth rate.")

    earnings_growth_decimal = percent_to_decimal(earnings_growth_percent)
    cost_of_equity_decimal = percent_to_decimal(cost_of_equity_percent)
    terminal_growth_decimal = percent_to_decimal(terminal_percent)
    payout_ratio_decimal = percent_to_decimal(payout_ratio_percent)

    residual_income_rows = []
    present_value_of_residual_income = 0.0
    beginning_book_value = base_book_value
    previous_net_income = current_net_income
    final_year_residual_income = None

    for year in range(1, projection_years + 1):
        projected_net_income = previous_net_income * (1 + earnings_growth_decimal)
        equity_charge = beginning_book_value * cost_of_equity_decimal
        residual_income = projected_net_income - equity_charge
        present_value = residual_income / ((1 + cost_of_equity_decimal) ** year)
        ending_book_value = beginning_book_value + (
            projected_net_income * (1 - payout_ratio_decimal)
        )

        residual_income_rows.append({
            "year": year,
            "beginningBookValue": round_optional(beginning_book_value),
            "projectedNetIncome": round_optional(projected_net_income),
            "equityCharge": round_optional(equity_charge),
            "residualIncome": round_optional(residual_income),
            "presentValue": round_optional(present_value),
            "endingBookValue": round_optional(ending_book_value),
        })

        present_value_of_residual_income += present_value
        final_year_residual_income = residual_income
        previous_net_income = projected_net_income
        beginning_book_value = ending_book_value

    terminal_residual_value = (
        final_year_residual_income * (1 + terminal_growth_decimal)
    ) / (cost_of_equity_decimal - terminal_growth_decimal)
    present_value_of_terminal_residual_value = (
        terminal_residual_value / ((1 + cost_of_equity_decimal) ** projection_years)
    )

    equity_value = (
        base_book_value
        + present_value_of_residual_income
        + present_value_of_terminal_residual_value
    )
    intrinsic_value_per_share = safe_divide(equity_value, shares_outstanding)

    upside_downside_percent = None
    if stock_price is not None and intrinsic_value_per_share is not None:
        upside_downside_percent = to_percent(
            safe_divide(intrinsic_value_per_share - stock_price, stock_price)
        )

    terminal_value_share_percent = to_percent(
        safe_divide(present_value_of_terminal_residual_value, equity_value)
    )

    return {
        "assumptions": {
            "earningsGrowthRate": round_optional(earnings_growth_percent),
            "costOfEquity": round_optional(cost_of_equity_percent),
            "terminalGrowthRate": round_optional(terminal_percent),
            "payoutRatio": round_optional(payout_ratio_percent),
            "projectionYears": projection_years,
        },
        "residualIncomeRows": residual_income_rows,
        "presentValueOfResidualIncome": round_optional(present_value_of_residual_income),
        "terminalResidualValue": round_optional(terminal_residual_value),
        "presentValueOfTerminalResidualValue": round_optional(
            present_value_of_terminal_residual_value
        ),
        "terminalValueSharePercent": round_optional(terminal_value_share_percent),
        "equityValue": round_optional(equity_value),
        "intrinsicValuePerShare": round_optional(intrinsic_value_per_share),
        "upsideDownsidePercent": round_optional(upside_downside_percent),
        "valuationSignal": _valuation_signal(upside_downside_percent),
    }


def _relative_value_change(base_value, changed_value):
    if base_value is None or changed_value is None or base_value == 0:
        return None
    return abs((changed_value - base_value) / base_value) * 100


def _build_sensitivity_matrix(
    base_fcf,
    cash,
    total_debt,
    shares_outstanding,
    stock_price,
    growth_percent,
    discount_percent,
    terminal_percent,
    projection_years,
):
    discount_rates = [
        round(discount_percent + offset, 2)
        for offset in (-1.0, -0.5, 0.0, 0.5, 1.0)
    ]
    terminal_growth_rates = [
        round(terminal_percent + offset, 2)
        for offset in (-1.0, -0.5, 0.0, 0.5, 1.0)
    ]

    rows = []
    for terminal_rate in terminal_growth_rates:
        values = []
        for discount_rate in discount_rates:
            if discount_rate <= 0 or discount_rate <= terminal_rate:
                values.append(None)
                continue

            result = _calculate_exact_dcf(
                base_fcf,
                cash,
                total_debt,
                shares_outstanding,
                stock_price,
                growth_percent,
                discount_rate,
                terminal_rate,
                projection_years,
            )
            values.append(result["intrinsicValuePerShare"])

        rows.append({
            "terminalGrowthRate": terminal_rate,
            "values": values,
        })

    return {
        "discountRates": discount_rates,
        "terminalGrowthRates": terminal_growth_rates,
        "rows": rows,
    }


def evaluate_scenario_lab(data):
    company_name = data.get("companyName") or "Unknown Company"
    stock_price = as_number(data.get("stockPrice"))
    shares_outstanding = as_number(data.get("SO"))

    base_fcf = as_number(data.get("FCF"))
    cash = as_number(data.get("cash"))
    total_debt = as_number(data.get("tDebt"))
    dcf_growth = as_number(data.get("dcfGrowth"))
    dcf_discount = as_number(data.get("dcfDiscountRate"))
    dcf_terminal = as_number(data.get("dcfTerminalGrowth"))
    dcf_years_raw = as_number(data.get("dcfProjectionYears"))

    base_book_value = as_number(data.get("tEquity"))
    current_net_income = as_number(data.get("netInc"))
    rim_growth = as_number(data.get("rimGrowth"))
    cost_of_equity = as_number(data.get("costOfEquity"))
    rim_terminal = as_number(data.get("rimTerminalGrowth"))
    payout_ratio = as_number(data.get("payoutRatio"))
    rim_years_raw = as_number(data.get("rimProjectionYears"))

    errors = []
    validate_positive(stock_price, "Current Stock Price", errors)
    validate_positive(shares_outstanding, "Shares Outstanding", errors)
    validate_positive(base_fcf, "Current Free Cash Flow", errors)
    validate_positive(dcf_discount, "DCF Discount Rate", errors)
    validate_positive(base_book_value, "Book Value of Equity", errors)
    validate_positive(current_net_income, "Current Net Income", errors)
    validate_positive(cost_of_equity, "RIM Cost of Equity", errors)

    if cash is None:
        errors.append("Cash and Cash Equivalents is required.")
    if total_debt is None:
        errors.append("Total Debt is required.")
    if dcf_growth is None:
        errors.append("DCF Growth Rate is required.")
    if dcf_terminal is None:
        errors.append("DCF Terminal Growth Rate is required.")
    if rim_growth is None:
        errors.append("RIM Earnings Growth Rate is required.")
    if rim_terminal is None:
        errors.append("RIM Terminal Growth Rate is required.")

    validate_percentage_range(payout_ratio, "Dividend Payout Ratio", errors, 0, 100)

    dcf_years = None
    if dcf_years_raw is None:
        errors.append("DCF Projection Years is required.")
    else:
        dcf_years = int(dcf_years_raw)
        if dcf_years < 1 or dcf_years > 10:
            errors.append("DCF Projection Years must be between 1 and 10.")

    rim_years = None
    if rim_years_raw is None:
        errors.append("RIM Projection Years is required.")
    else:
        rim_years = int(rim_years_raw)
        if rim_years < 1 or rim_years > 10:
            errors.append("RIM Projection Years must be between 1 and 10.")

    if dcf_discount is not None and dcf_terminal is not None:
        if dcf_discount <= dcf_terminal:
            errors.append("DCF Discount Rate must be greater than DCF Terminal Growth Rate.")

    if cost_of_equity is not None and rim_terminal is not None:
        if cost_of_equity <= rim_terminal:
            errors.append("RIM Cost of Equity must be greater than RIM Terminal Growth Rate.")

    if errors:
        return {
            "error": "Invalid Scenario Lab input.",
            "details": errors,
        }

    scenarios = []
    scenario_results_by_key = {}

    for key, definition in SCENARIO_DEFINITIONS.items():
        scenario_dcf_growth = dcf_growth + definition["growth_delta"]
        scenario_dcf_discount = dcf_discount + definition["discount_delta"]
        scenario_dcf_terminal = dcf_terminal + definition["terminal_delta"]

        scenario_rim_growth = rim_growth + definition["growth_delta"]
        scenario_cost_of_equity = cost_of_equity + definition["discount_delta"]
        scenario_rim_terminal = rim_terminal + definition["terminal_delta"]

        scenario_entry = {
            "key": key,
            "name": definition["name"],
            "adjustments": {
                "growthDelta": definition["growth_delta"],
                "requiredReturnDelta": definition["discount_delta"],
                "terminalGrowthDelta": definition["terminal_delta"],
            },
        }

        try:
            scenario_entry["dcf"] = _calculate_exact_dcf(
                base_fcf,
                cash,
                total_debt,
                shares_outstanding,
                stock_price,
                scenario_dcf_growth,
                scenario_dcf_discount,
                scenario_dcf_terminal,
                dcf_years,
            )
        except ValueError as error:
            scenario_entry["dcf"] = {"error": str(error)}

        try:
            scenario_entry["rim"] = _calculate_exact_rim(
                base_book_value,
                current_net_income,
                shares_outstanding,
                stock_price,
                scenario_rim_growth,
                scenario_cost_of_equity,
                scenario_rim_terminal,
                payout_ratio,
                rim_years,
            )
        except ValueError as error:
            scenario_entry["rim"] = {"error": str(error)}

        valid_values = []
        for method in ("dcf", "rim"):
            method_value = scenario_entry.get(method, {}).get("intrinsicValuePerShare")
            if method_value is not None:
                valid_values.append(method_value)

        scenario_entry["valuationRange"] = {
            "low": round_optional(min(valid_values)) if valid_values else None,
            "high": round_optional(max(valid_values)) if valid_values else None,
        }

        scenarios.append(scenario_entry)
        scenario_results_by_key[key] = scenario_entry

    base_scenario = scenario_results_by_key["base"]
    base_dcf = base_scenario["dcf"]
    base_rim = base_scenario["rim"]

    sensitivity_matrix = _build_sensitivity_matrix(
        base_fcf,
        cash,
        total_debt,
        shares_outstanding,
        stock_price,
        dcf_growth,
        dcf_discount,
        dcf_terminal,
        dcf_years,
    )

    driver_candidates = []

    dcf_driver_tests = [
        ("DCF Growth Rate", dcf_growth + 1.0, dcf_discount, dcf_terminal),
        ("DCF Discount Rate", dcf_growth, dcf_discount + 1.0, dcf_terminal),
        ("DCF Terminal Growth", dcf_growth, dcf_discount, dcf_terminal + 0.5),
    ]

    for label, changed_growth, changed_discount, changed_terminal in dcf_driver_tests:
        if changed_discount <= changed_terminal:
            continue
        changed_result = _calculate_exact_dcf(
            base_fcf,
            cash,
            total_debt,
            shares_outstanding,
            stock_price,
            changed_growth,
            changed_discount,
            changed_terminal,
            dcf_years,
        )
        impact = _relative_value_change(
            base_dcf.get("intrinsicValuePerShare"),
            changed_result.get("intrinsicValuePerShare"),
        )
        if impact is not None:
            driver_candidates.append({
                "label": label,
                "method": "DCF",
                "impactPercent": round_optional(impact),
            })

    rim_driver_tests = [
        ("RIM Earnings Growth", rim_growth + 1.0, cost_of_equity, rim_terminal, payout_ratio),
        ("RIM Cost of Equity", rim_growth, cost_of_equity + 1.0, rim_terminal, payout_ratio),
        ("RIM Terminal Growth", rim_growth, cost_of_equity, rim_terminal + 0.5, payout_ratio),
        ("RIM Payout Ratio", rim_growth, cost_of_equity, rim_terminal, min(100, payout_ratio + 10.0)),
    ]

    for label, changed_growth, changed_cost, changed_terminal, changed_payout in rim_driver_tests:
        if changed_cost <= changed_terminal:
            continue
        changed_result = _calculate_exact_rim(
            base_book_value,
            current_net_income,
            shares_outstanding,
            stock_price,
            changed_growth,
            changed_cost,
            changed_terminal,
            changed_payout,
            rim_years,
        )
        impact = _relative_value_change(
            base_rim.get("intrinsicValuePerShare"),
            changed_result.get("intrinsicValuePerShare"),
        )
        if impact is not None:
            driver_candidates.append({
                "label": label,
                "method": "RIM",
                "impactPercent": round_optional(impact),
            })

    key_value_drivers = sorted(
        driver_candidates,
        key=lambda item: item["impactPercent"],
        reverse=True,
    )[:3]

    warnings = []
    dcf_terminal_share = base_dcf.get("terminalValueSharePercent")
    rim_terminal_share = base_rim.get("terminalValueSharePercent")

    if dcf_terminal_share is not None and dcf_terminal_share >= 70:
        warnings.append({
            "level": "high",
            "title": "High DCF terminal value dependency",
            "message": f"{dcf_terminal_share:.2f}% of enterprise value comes from terminal value. Small changes in discount rate or terminal growth can materially change the result.",
        })

    if rim_terminal_share is not None and abs(rim_terminal_share) >= 50:
        warnings.append({
            "level": "medium",
            "title": "High RIM terminal value dependency",
            "message": f"Terminal residual income contributes {rim_terminal_share:.2f}% of the calculated equity value.",
        })

    if (dcf_discount - dcf_terminal) < 2.0:
        warnings.append({
            "level": "high",
            "title": "Narrow DCF rate spread",
            "message": "The difference between discount rate and terminal growth is below 2 percentage points, making the DCF result highly sensitive.",
        })

    if (cost_of_equity - rim_terminal) < 2.0:
        warnings.append({
            "level": "high",
            "title": "Narrow RIM rate spread",
            "message": "The difference between cost of equity and terminal growth is below 2 percentage points, making the RIM result highly sensitive.",
        })

    if dcf_growth > 15 or rim_growth > 15:
        warnings.append({
            "level": "medium",
            "title": "Aggressive long-term growth assumption",
            "message": "At least one explicit growth assumption exceeds 15%. Confirm that the projection period and competitive position support this rate.",
        })

    dcf_fair_value = base_dcf.get("intrinsicValuePerShare")
    rim_fair_value = base_rim.get("intrinsicValuePerShare")
    if dcf_fair_value is not None and rim_fair_value is not None:
        comparison_base = (abs(dcf_fair_value) + abs(rim_fair_value)) / 2
        divergence_percent = None
        if comparison_base > 0:
            divergence_percent = abs(dcf_fair_value - rim_fair_value) / comparison_base * 100
            if divergence_percent >= 30:
                warnings.append({
                    "level": "medium",
                    "title": "Large DCF and RIM divergence",
                    "message": f"Base-case DCF and RIM values differ by {divergence_percent:.2f}%. Review cash-flow, book-value, and growth assumptions instead of averaging the two values.",
                })
    else:
        divergence_percent = None

    if not warnings:
        warnings.append({
            "level": "low",
            "title": "No major assumption warning detected",
            "message": "The supplied base assumptions pass the Scenario Lab consistency checks. This does not remove forecasting risk.",
        })

    return {
        "companyName": company_name,
        "currentStockPrice": round_optional(stock_price),
        "scenarios": scenarios,
        "sensitivityMatrix": sensitivity_matrix,
        "keyValueDrivers": key_value_drivers,
        "warnings": warnings,
        "methodDivergencePercent": round_optional(divergence_percent),
        "scenarioPolicy": {
            "bear": "Growth -2.0 pts, required return +1.0 pt, terminal growth -0.5 pt",
            "base": "Uses the entered assumptions without adjustment",
            "bull": "Growth +2.0 pts, required return -1.0 pt, terminal growth +0.5 pt",
        },
    }
