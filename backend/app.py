from flask import Flask, request, jsonify
from flask_cors import CORS
from evaluator import evaluate_company, evaluate_dcf, evaluate_rim, evaluate_scenario_lab

app = Flask(__name__)
CORS(app)


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Company Evaluation Backend is running."
    })


def get_json_payload():
    data = request.get_json(silent=True)

    if data is None:
        return None, (jsonify({
            "error": "No JSON data received."
        }), 400)

    return data, None


@app.route("/evaluate", methods=["POST"])
def evaluate():
    data, error_response = get_json_payload()
    if error_response is not None:
        return error_response

    try:
        result = evaluate_company(data)
    except Exception as error:
        return jsonify({
            "error": "Evaluation failed.",
            "details": [str(error)]
        }), 500

    return jsonify(result), 200


@app.route("/evaluate-dcf", methods=["POST"])
def evaluate_dcf_route():
    data, error_response = get_json_payload()
    if error_response is not None:
        return error_response

    try:
        result = evaluate_dcf(data)
    except Exception as error:
        return jsonify({
            "error": "DCF evaluation failed.",
            "details": [str(error)]
        }), 500

    if "error" in result:
        return jsonify(result), 400

    return jsonify(result), 200


@app.route("/evaluate-rim", methods=["POST"])
def evaluate_rim_route():
    data, error_response = get_json_payload()
    if error_response is not None:
        return error_response

    try:
        result = evaluate_rim(data)
    except Exception as error:
        return jsonify({
            "error": "RIM evaluation failed.",
            "details": [str(error)]
        }), 500

    if "error" in result:
        return jsonify(result), 400

    return jsonify(result), 200


@app.route("/evaluate-scenario-lab", methods=["POST"])
def evaluate_scenario_lab_route():
    data, error_response = get_json_payload()
    if error_response is not None:
        return error_response

    try:
        result = evaluate_scenario_lab(data)
    except Exception as error:
        return jsonify({
            "error": "Scenario Lab evaluation failed.",
            "details": [str(error)]
        }), 500

    if "error" in result:
        return jsonify(result), 400

    return jsonify(result), 200


if __name__ == "__main__":
    app.run(debug=True, port=5000)
