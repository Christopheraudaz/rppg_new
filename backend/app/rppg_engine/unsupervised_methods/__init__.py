"""
rPPG Standalone Package
Simplified remote photoplethysmography for heart rate estimation.
"""

__version__ = "1.0.0"

from .methods.POS_WANG import POS_WANG
from .methods.CHROME_DEHAAN import CHROME_DEHAAN
from .methods.GREEN import GREEN

__all__ = ['POS_WANG', 'CHROME_DEHAAN', 'GREEN']