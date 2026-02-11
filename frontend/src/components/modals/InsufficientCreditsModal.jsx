import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCredits } from '../../contexts/CreditsContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { AlertTriangle } from 'lucide-react';

export default function InsufficientCreditsModal() {
  const { showModal, errorDetail, closeCreditsModal } = useCredits();
  const navigate = useNavigate();

  return (
    <Dialog open={showModal} onOpenChange={closeCreditsModal}>
      <DialogContent className="sm:max-w-md" data-testid="insufficient-credits-modal">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <DialogTitle className="text-lg">Недостаточно кредитов</DialogTitle>
          </div>
        </DialogHeader>

        <div className="py-3 space-y-3">
          <p className="text-sm text-slate-600" data-testid="credits-modal-detail">
            {errorDetail}
          </p>
          <p className="text-sm text-slate-500">
            Пополните баланс в разделе <strong>Биллинг</strong>, чтобы продолжить использование AI-функций.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={closeCreditsModal}
            data-testid="credits-modal-close-btn"
          >
            Закрыть
          </Button>
          <Button
            onClick={() => {
              closeCreditsModal();
              navigate('/billing');
            }}
            data-testid="credits-modal-billing-btn"
          >
            Перейти в Биллинг
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
