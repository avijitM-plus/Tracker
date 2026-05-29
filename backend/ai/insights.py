import os

def generate_insights(app_summary, web_summary):
    """
    Dummy AI insights generator. 
    In production, this would call OpenAI or a local LLM.
    """
    insights = []
    
    total_app_time = sum(app_summary.values())
    if total_app_time > 0:
        top_app = max(app_summary, key=app_summary.get)
        hours = total_app_time / 3600
        insights.append(f"You spent {hours:.1f} hours using apps today, with {top_app} taking up the most time.")
        
    if "Visual Studio Code" in app_summary or "Code" in app_summary:
        insights.append("Great job focusing on coding today! Keep up the momentum.")
        
    if not insights:
        insights.append("Not enough data to generate insights yet. Keep working!")
        
    return insights
