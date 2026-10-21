import os
from huggingface_hub import InferenceClient

# Te registras en Hugging Face (gratis) y generas un Token de acceso
# La capa serverless te permite miles de solicitudes gratis al mes
client = InferenceClient(
    model="meta-llama/Meta-Llama-3-8B-Instruct",
    token=os.environ.get("HF_TOKEN") 
)

def asistente_financiero_gratis(historial_ventas, datos_brecha, pregunta_usuario):
    system_prompt = f"""
    Eres un asistente financiero para comercios en Venezuela.
    Tasa Binance P2P: {datos_brecha['binance_p2p']} Bs.
    Tasa BCV: {datos_brecha['bcv']} Bs.
    Brecha: {datos_brecha['brecha_porcentaje']}%.
    Ayuda al usuario con su inventario basándote en estos datos. Responde corto y en español.
    """
    
    prompt_final = f"<|system|>\n{system_prompt}</s>\n<|user|>\nHistorial: {historial_ventas}. Pregunta: {pregunta_usuario}</s>\n<|assistant|>\n"
    
    response = client.text_generation(
        prompt_final,
        max_new_tokens=200,
        temperature=0.3
    )
    return response
